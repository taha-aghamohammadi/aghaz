import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  BUSINESS_HOUR_END,
  BUSINESS_HOUR_START,
  computeBookingWindow,
  computeTotalAmount,
  expireStalePendingBookings,
  fetchPricingSettings,
  generateBookingCode,
  iranDateTime,
  isDeskAvailable,
  mapPublicDesk,
  unitPriceForType,
  type BookingType,
  type PublicDesk,
} from "@/lib/booking.service";

const bookingInputSchema = z.object({
  deskIds: z.array(z.string().uuid()).min(1).max(4),
  bookingType: z.enum(["hourly", "daily", "monthly"]),
  dateStr: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startHour: z.number().int().min(BUSINESS_HOUR_START).max(BUSINESS_HOUR_END).optional(),
  duration: z.number().int().min(1).max(365).optional(),
  months: z.number().int().min(1).max(12).optional(),
  note: z.string().trim().max(200).optional().default(""),
});

export const getPublicPricing = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return fetchPricingSettings(supabaseAdmin);
});

export const listPublicDesks = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z
      .object({
        windowStart: z.string().optional(),
        windowEnd: z.string().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // ponytail: Tehran date, not UTC — fallback must match client iranDateTime logic
    const tehranDateStr = (() => {
      const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
      const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
      return `${g("year")}-${g("month")}-${g("day")}`;
    })();
    const windowStart =
      data.windowStart ?? iranDateTime(tehranDateStr, BUSINESS_HOUR_START);
    const windowEnd =
      data.windowEnd ?? iranDateTime(tehranDateStr, BUSINESS_HOUR_END);

    const [desksRes, bookingsRes, pricing] = await Promise.all([
      supabaseAdmin.from("desks").select("*").eq("is_active", true).order("code"),
      supabaseAdmin
        .from("bookings")
        .select("*")
        .neq("status", "cancelled")
        .lt("start_at", windowEnd)
        .gt("end_at", windowStart),
      fetchPricingSettings(supabaseAdmin),
    ]);

    if (desksRes.error) throw new Error("خواندن میزها ناموفق بود.");
    const cancelled = await expireStalePendingBookings(bookingsRes.data ?? []);
    const bookings = (bookingsRes.data ?? []).filter((b) => !cancelled.has(b.id));
    const desks = (desksRes.data ?? []).map((d) =>
      mapPublicDesk(d, bookings, windowStart, windowEnd),
    );
    const card = await supabaseAdmin
      .from("pricing_settings")
      .select("card_number, card_holder")
      .eq("id", "00000000-0000-0000-0000-000000000001")
      .maybeSingle();
    return {
      desks,
      pricing,
      windowStart,
      windowEnd,
      cardNumber: card.data?.card_number ?? "",
      cardHolder: card.data?.card_holder ?? "",
    };
  });

export const checkDeskAvailability = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        deskId: z.string().uuid(),
        bookingType: z.enum(["hourly", "daily", "monthly"]),
        dateStr: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        startHour: z.number().int().optional(),
        duration: z.number().int().optional(),
        months: z.number().int().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
    return { available, ...window };
  });

export const createUserBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => bookingInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const supabase = context.supabase;

    const window = computeBookingWindow({
      bookingType: data.bookingType,
      dateStr: data.dateStr,
      startHour: data.startHour,
      duration: data.duration,
      months: data.months,
    });

    const pricing = await fetchPricingSettings(supabaseAdmin);
    const unitPrice = unitPriceForType(pricing, data.bookingType);

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", context.userId)
      .maybeSingle();

    const unavailableDeskCodes: string[] = [];
    let lastRow: { id: string; code: string; unit_price: number; total_amount: number } | null =
      null;

    for (const deskId of data.deskIds) {
      const { data: desk, error: deskErr } = await supabase
        .from("desks")
        .select("*")
        .eq("id", deskId)
        .eq("is_active", true)
        .maybeSingle();

      if (deskErr || !desk) {
        unavailableDeskCodes.push(deskId.slice(0, 8));
        continue;
      }
      if (desk.status === "maintenance") {
        unavailableDeskCodes.push(desk.code);
        continue;
      }

      const available = await isDeskAvailable(supabaseAdmin, deskId, window.startAt, window.endAt);
      if (!available) {
        unavailableDeskCodes.push(desk.code);
        continue;
      }

      let code = generateBookingCode();
      for (let i = 0; i < 5; i++) {
        const { data: existing } = await supabaseAdmin
          .from("bookings")
          .select("id")
          .eq("code", code)
          .maybeSingle();
        if (!existing) break;
        code = generateBookingCode();
      }

      const totalAmount = computeTotalAmount(unitPrice, window.units);
      const { data: row, error } = await supabase
        .from("bookings")
        .insert({
          code,
          user_id: context.userId,
          desk_id: deskId,
          desk_code: desk.code,
          booking_type: data.bookingType,
          start_at: window.startAt,
          end_at: window.endAt,
          units: window.units,
          unit_price: unitPrice,
          total_amount: totalAmount,
          status: "pending",
          payment_status: "unpaid",
          full_name: profile?.full_name ?? "",
          phone: profile?.phone ?? "",
          note: data.note,
        })
        .select(
          "id, code, desk_code, booking_type, start_at, end_at, units, unit_price, total_amount, status, payment_status",
        )
        .single();

      if (error) throw new Error("ثبت رزرو ناموفق بود.");
      lastRow = row;
    }

    if (unavailableDeskCodes.length > 0) {
      return {
        unavailableDeskCodes,
        id: null as string | null,
        code: null as string | null,
        unit_price: null as number | null,
        total_amount: null as number | null,
      };
    }
    if (!lastRow) throw new Error("هیچ میزی انتخاب نشد.");
    return {
      unavailableDeskCodes: [] as string[],
      id: lastRow.id as string,
      code: lastRow.code as string,
      unit_price: lastRow.unit_price as number,
      total_amount: lastRow.total_amount as number,
    };
  });

export const cancelMyBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: booking, error: readErr } = await context.supabase
      .from("bookings")
      .select("id, user_id, status")
      .eq("id", data.id)
      .maybeSingle();

    if (readErr || !booking) throw new Error("رزرو پیدا نشد.");
    if (booking.user_id !== context.userId) throw new Error("این رزرو متعلق به شما نیست.");
    if (booking.status !== "pending") throw new Error("فقط رزروهای در انتظار قابل لغو هستند.");

    const { error } = await context.supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", data.id);

    if (error) throw new Error("لغو رزرو ناموفق بود.");
    return { ok: true };
  });

export type { PublicDesk, BookingType };

export const listMyBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("bookings")
      .select(
        "id, code, desk_code, booking_type, start_at, end_at, units, unit_price, total_amount, status, payment_status, created_at",
      )
      .eq("user_id", context.userId)
      .order("start_at", { ascending: false })
      .limit(50);
    if (error) throw new Error("خواندن رزروها ناموفق بود.");
    const rows = data ?? [];
    const cancelled = await expireStalePendingBookings(rows);
    if (cancelled.size > 0) {
      return rows.map((r) => (cancelled.has(r.id) ? { ...r, status: "cancelled" } : r));
    }
    return rows;
  });
