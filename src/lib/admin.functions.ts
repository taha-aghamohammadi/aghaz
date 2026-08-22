import { createServerFn } from "@tanstack/react-start";
import { addDays } from "date-fns";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  computeBookingWindow,
  computeTotalAmount,
  DEFAULT_PRICING,
  expireStalePendingBookings,
  fetchPricingSettings,
  generateBookingCode,
  isDeskAvailable,
  mapPricingRow,
  requireStaff,
  unitPriceForType,
  type PricingRow,
} from "@/lib/booking.service";

export const getMyAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = (data ?? []).map((r) => r.role as string);
    return {
      userId: context.userId,
      roles,
      isAdmin: roles.includes("admin"),
      isStaff: roles.includes("admin") || roles.includes("staff"),
    };
  });

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context.supabase, context.userId);
    const supabase = context.supabase;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [bookings, desks, profiles, tx] = await Promise.all([
      supabase
        .from("bookings")
        .select(
          "id, code, full_name, desk_code, booking_type, start_at, total_amount, status, payment_status, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("desks").select("id, status, is_active"),
      supabase.from("profiles").select("id, created_at"),
      supabase
        .from("transactions")
        .select("kind, amount, occurred_on")
        .gte("occurred_on", monthStart.slice(0, 10)),
    ]);

    const rows = bookings.data ?? [];
    const active = rows.filter((b) => b.status !== "cancelled");
    const paidTotal = active
      .filter((b) => b.payment_status === "paid")
      .reduce((s, b) => s + (b.total_amount ?? 0), 0);
    const monthTotal = active
      .filter((b) => new Date(b.created_at) >= new Date(monthStart))
      .reduce((s, b) => s + (b.total_amount ?? 0), 0);

    const income = (tx.data ?? [])
      .filter((t) => t.kind === "income")
      .reduce((s, t) => s + t.amount, 0);
    const expense = (tx.data ?? [])
      .filter((t) => t.kind === "expense")
      .reduce((s, t) => s + t.amount, 0);

    const deskRows = desks.data ?? [];
    const byType = {
      hourly: active.filter((b) => b.booking_type === "hourly").length,
      daily: active.filter((b) => b.booking_type === "daily").length,
      monthly: active.filter((b) => b.booking_type === "monthly").length,
    };

    return {
      totals: {
        bookings: active.length,
        pending: rows.filter((b) => b.status === "pending").length,
        unpaid: active.filter((b) => b.payment_status !== "paid").length,
        revenue: paidTotal,
        monthRevenue: monthTotal,
        users: (profiles.data ?? []).length,
        desks: deskRows.length,
        busyDesks: deskRows.filter((d) => d.status !== "free").length,
      },
      finance: { income, expense, net: income - expense },
      byType,
      recent: rows.slice(0, 8),
    };
  });

export const listBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        search: z.string().trim().max(80).optional().default(""),
        status: z.string().trim().max(20).optional().default("all"),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.supabase, context.userId);
    let query = context.supabase
      .from("bookings")
      .select(
        "id, code, user_id, desk_code, booking_type, start_at, end_at, units, unit_price, total_amount, status, payment_status, full_name, phone, note, checked_in_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(300);

    if (data.status !== "all") query = query.eq("status", data.status);
    if (data.search) {
      const s = data.search.replace(/[%,]/g, "");
      query = query.or(
        `code.ilike.%${s}%,full_name.ilike.%${s}%,phone.ilike.%${s}%,desk_code.ilike.%${s}%`,
      );
    }

    const { data: rows, error } = await query;
    if (error) throw new Error("خواندن رزروها ناموفق بود.");
    const list = rows ?? [];
    const cancelled = await expireStalePendingBookings(list);
    if (cancelled.size === 0) return list;
    return list.map((r) => (cancelled.has(r.id) ? { ...r, status: "cancelled" } : r));
  });

export const updateBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["pending", "confirmed", "cancelled", "done"]).optional(),
        paymentStatus: z.enum(["unpaid", "paid", "refunded"]).optional(),
        checkIn: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.supabase, context.userId);
    const patch: {
      status?: string;
      payment_status?: string;
      checked_in_at?: string | null;
    } = {};
    if (data.status) patch.status = data.status;
    if (data.paymentStatus) patch.payment_status = data.paymentStatus;
    if (data.checkIn !== undefined)
      patch.checked_in_at = data.checkIn ? new Date().toISOString() : null;

    const { error } = await context.supabase.from("bookings").update(patch).eq("id", data.id);
    if (error) throw new Error("به‌روزرسانی رزرو ناموفق بود (دسترسی مدیر لازم است).");
    return { ok: true };
  });

export const deleteBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireStaff(context.supabase, context.userId);
    const { error } = await context.supabase.from("bookings").delete().eq("id", data.id);
    if (error) throw new Error("حذف رزرو ناموفق بود.");
    return { ok: true };
  });

export const createBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        deskId: z.string().uuid(),
        bookingType: z.enum(["hourly", "daily", "monthly"]),
        dateStr: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        startHour: z.number().int().min(8).max(20).optional(),
        duration: z.number().int().min(1).max(365).optional(),
        months: z.number().int().min(1).max(12).optional(),
        fullName: z.string().trim().max(80).optional().default(""),
        phone: z.string().trim().max(20).optional().default(""),
        status: z.enum(["pending", "confirmed"]).optional().default("confirmed"),
        paymentStatus: z.enum(["unpaid", "paid"]).optional().default("paid"),
        note: z.string().trim().max(200).optional().default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: desk, error: deskErr } = await context.supabase
      .from("desks")
      .select("*")
      .eq("id", data.deskId)
      .maybeSingle();
    if (deskErr || !desk) throw new Error("میز پیدا نشد.");

    const window = computeBookingWindow({
      bookingType: data.bookingType,
      dateStr: data.dateStr,
      startHour: data.startHour,
      duration: data.duration,
      months: data.months,
    });

    const available = await isDeskAvailable(
      supabaseAdmin,
      data.deskId,
      window.startAt,
      window.endAt,
    );
    if (!available) throw new Error("میز در این بازه رزرو شده است.");

    const pricing = await fetchPricingSettings(supabaseAdmin);
    const unitPrice = unitPriceForType(pricing, data.bookingType);
    const totalAmount = computeTotalAmount(unitPrice, window.units);
    const code = generateBookingCode();

    const { error } = await context.supabase.from("bookings").insert({
      code,
      user_id: context.userId,
      desk_id: data.deskId,
      desk_code: desk.code,
      booking_type: data.bookingType,
      start_at: window.startAt,
      end_at: window.endAt,
      units: window.units,
      unit_price: unitPrice,
      total_amount: totalAmount,
      status: data.status,
      payment_status: data.paymentStatus,
      full_name: data.fullName,
      phone: data.phone,
      note: data.note,
    });
    if (error) throw new Error("ثبت رزرو در سامانه ناموفق بود.");
    return { ok: true, code };
  });

export const listDesks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("desks")
      .select("*")
      .order("code", { ascending: true });
    if (error) throw new Error("خواندن میزها ناموفق بود.");
    return data ?? [];
  });

export const getPricingSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin
      .from("pricing_settings")
      .select("*")
      .eq("id", "00000000-0000-0000-0000-000000000001")
      .maybeSingle();

    if (error || !data) {
      return {
        hourlyRate: DEFAULT_PRICING.hourlyRate,
        dailyRate: DEFAULT_PRICING.dailyRate,
        monthlyRate: DEFAULT_PRICING.monthlyRate,
        discountPercent: DEFAULT_PRICING.discountPercent,
        discountEndsAt: DEFAULT_PRICING.discountEndsAt,
        maxDesksPerBooking: DEFAULT_PRICING.maxDesksPerBooking,
        cardNumber: "",
        cardHolder: "",
        updatedAt: null as string | null,
        source: "defaults" as const,
      };
    }

    const pricing = mapPricingRow(data as PricingRow);
    return {
      ...pricing,
      cardNumber: (data as PricingRow).card_number ?? "",
      cardHolder: (data as PricingRow).card_holder ?? "",
      updatedAt: (data as { updated_at?: string }).updated_at ?? null,
      source: "database" as const,
    };
  });

export const updatePricingSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        hourlyRate: z.number().int().min(1).optional(),
        dailyRate: z.number().int().min(1).optional(),
        monthlyRate: z.number().int().min(1).optional(),
        discountPercent: z.number().int().min(0).max(100).optional(),
        discountDurationDays: z.number().int().min(1).max(365).optional(),
        cardNumber: z.string().trim().max(40).optional(),
        cardHolder: z.string().trim().max(80).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.supabase, context.userId);

    const hasRate =
      data.hourlyRate !== undefined ||
      data.dailyRate !== undefined ||
      data.monthlyRate !== undefined;
    const hasDiscount =
      data.discountPercent !== undefined || data.discountDurationDays !== undefined;
    const hasCard = data.cardNumber !== undefined || data.cardHolder !== undefined;
    if (!hasRate && !hasDiscount && !hasCard) {
      throw new Error("حداقل یک فیلد برای به‌روزرسانی وارد کنید.");
    }

    const { data: current, error: readErr } = await context.supabase
      .from("pricing_settings")
      .select("*")
      .eq("id", "00000000-0000-0000-0000-000000000001")
      .maybeSingle();
    if (readErr) throw new Error("خواندن تعرفه‌های فعلی ناموفق بود.");

    const patch: {
      hourly_rate?: number;
      daily_rate?: number;
      monthly_rate?: number;
      discount_percent?: number;
      discount_ends_at?: string | null;
      card_number?: string;
      card_holder?: string;
      updated_at: string;
    } = { updated_at: new Date().toISOString() };

    if (data.hourlyRate !== undefined) patch.hourly_rate = data.hourlyRate;
    if (data.dailyRate !== undefined) patch.daily_rate = data.dailyRate;
    if (data.monthlyRate !== undefined) patch.monthly_rate = data.monthlyRate;

    if (data.discountPercent !== undefined) {
      patch.discount_percent = data.discountPercent;
      if (data.discountPercent === 0) {
        patch.discount_ends_at = null;
      } else if (data.discountDurationDays !== undefined) {
        patch.discount_ends_at = addDays(new Date(), data.discountDurationDays).toISOString();
      }
    } else if (data.discountDurationDays !== undefined) {
      const percent = (current as { discount_percent?: number } | null)?.discount_percent ?? 0;
      if (percent > 0) {
        patch.discount_ends_at = addDays(new Date(), data.discountDurationDays).toISOString();
      } else {
        throw new Error("برای تنظیم مدت تخفیف، ابتدا درصد تخفیف را وارد کنید.");
      }
    }

    if (data.cardNumber !== undefined) patch.card_number = data.cardNumber;
    if (data.cardHolder !== undefined) patch.card_holder = data.cardHolder;

    const { error } = await context.supabase
      .from("pricing_settings")
      .update(patch)
      .eq("id", "00000000-0000-0000-0000-000000000001");
    if (error) throw new Error("ذخیره تعرفه‌ها ناموفق بود.");
    return { ok: true };
  });

export const saveDesk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        code: z.string().trim().min(1).max(16),
        name: z.string().trim().min(1).max(60),
        zone: z.string().trim().max(40).optional().default(""),
        status: z.enum(["free", "busy", "reserved", "maintenance"]),
        features: z.string().trim().max(200).optional().default(""),
        locationNote: z.string().trim().max(160).optional().default(""),
        isActive: z.boolean().optional().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.supabase, context.userId);
    const payload = {
      code: data.code,
      name: data.name,
      zone: data.zone,
      status: data.status,
      features: data.features
        ? data.features
            .split("،")
            .map((f) => f.trim())
            .filter(Boolean)
        : [],
      location_note: data.locationNote,
      is_active: data.isActive,
    };
    const query = data.id
      ? context.supabase.from("desks").update(payload).eq("id", data.id)
      : context.supabase.from("desks").insert(payload);
    const { error } = await query;
    if (error) throw new Error("ذخیره میز ناموفق بود (دسترسی مدیر لازم است).");
    return { ok: true };
  });

export const deleteDesk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireStaff(context.supabase, context.userId);
    const { error } = await context.supabase.from("desks").delete().eq("id", data.id);
    if (error) throw new Error("حذف میز ناموفق بود.");
    return { ok: true };
  });

export const listMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context.supabase, context.userId);
    const [profiles, roles, bookings] = await Promise.all([
      context.supabase
        .from("profiles")
        .select("id, full_name, phone, national_id, job_title, education, created_at")
        .order("created_at", { ascending: false })
        .limit(300),
      context.supabase.from("user_roles").select("user_id, role"),
      context.supabase.from("bookings").select("user_id, total_amount, status"),
    ]);

    const roleMap = new Map<string, string[]>();
    for (const r of roles.data ?? []) {
      const list = roleMap.get(r.user_id) ?? [];
      list.push(r.role as string);
      roleMap.set(r.user_id, list);
    }

    const statMap = new Map<string, { count: number; spent: number }>();
    for (const b of bookings.data ?? []) {
      if (!b.user_id || b.status === "cancelled") continue;
      const s = statMap.get(b.user_id) ?? { count: 0, spent: 0 };
      s.count += 1;
      s.spent += b.total_amount ?? 0;
      statMap.set(b.user_id, s);
    }

    return (profiles.data ?? []).map((p) => ({
      ...p,
      roles: roleMap.get(p.id) ?? [],
      bookingCount: statMap.get(p.id)?.count ?? 0,
      totalSpent: statMap.get(p.id)?.spent ?? 0,
    }));
  });

export const setMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(["admin", "staff", "user"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("فقط مدیر می‌تواند نقش‌ها را تغییر دهد.");
    if (data.userId === context.userId) throw new Error("نقش حساب خودت را نمی‌توانی تغییر دهی.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    if (data.role !== "user") {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: data.userId, role: data.role });
      if (error) throw new Error("ثبت نقش ناموفق بود.");
    }
    return { ok: true };
  });

export const listTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context.supabase, context.userId);
    const [tx, bookings] = await Promise.all([
      context.supabase
        .from("transactions")
        .select("id, kind, category, amount, description, occurred_on, created_at")
        .order("occurred_on", { ascending: false })
        .limit(300),
      context.supabase
        .from("bookings")
        .select("total_amount, payment_status, status, booking_type, created_at")
        .limit(500),
    ]);

    const rows = tx.data ?? [];
    const income = rows.filter((r) => r.kind === "income").reduce((s, r) => s + r.amount, 0);
    const expense = rows.filter((r) => r.kind === "expense").reduce((s, r) => s + r.amount, 0);
    const paidBookings = (bookings.data ?? []).filter(
      (b) => b.status !== "cancelled" && b.payment_status === "paid",
    );

    return {
      rows,
      summary: {
        income,
        expense,
        net: income - expense,
        bookingRevenue: paidBookings.reduce((s, b) => s + (b.total_amount ?? 0), 0),
        bookingCount: paidBookings.length,
      },
    };
  });

export const saveTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        kind: z.enum(["income", "expense"]),
        category: z.string().trim().min(1).max(40),
        amount: z.number().int().min(0),
        description: z.string().trim().max(160).optional().default(""),
        occurredOn: z.string().min(8).max(12),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("transactions").insert({
      kind: data.kind,
      category: data.category,
      amount: data.amount,
      description: data.description,
      occurred_on: data.occurredOn,
      created_by: context.userId,
    });
    if (error) throw new Error("ثبت تراکنش ناموفق بود (دسترسی مدیر لازم است).");
    return { ok: true };
  });

export const deleteTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("transactions").delete().eq("id", data.id);
    if (error) throw new Error("حذف تراکنش ناموفق بود.");
    return { ok: true };
  });
