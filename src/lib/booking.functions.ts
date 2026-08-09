import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  BUSINESS_HOUR_END,
  BUSINESS_HOUR_START,
  computeBookingWindow,
  computeTotalAmount,
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
  deskId: z.string().uuid(),
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
    const now = new Date();
    const windowStart = data.windowStart ?? iranDateTime(now.toISOString().slice(0, 10), BUSINESS_HOUR_START);
    const windowEnd =
      data.windowEnd ??
      iranDateTime(now.toISOString().slice(0, 10), BUSINESS_HOUR_END);

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
    const bookings = bookingsRes.data ?? [];
    const desks = (desksRes.data ?? []).map((d) =>
      mapPublicDesk(d, bookings, windowStart, windowEnd),
    );
    return { desks, pricing, windowStart, windowEnd };
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

    const { data: desk, error: deskErr } = await supabase
      .from("desks")
      .select("*")
      .eq("id", data.deskId)
      .eq("is_active", true)
      .maybeSingle();

    if (deskErr || !desk) throw new Error("میز انتخاب‌شده موجود نیست.");
    if (desk.status === "maintenance") throw new Error("این میز در تعمیر است.");

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
    if (!available) throw new Error("این میز در بازه انتخابی رزرو شده است.");

    const pricing = await fetchPricingSettings(supabaseAdmin);
    const unitPrice = unitPriceForType(pricing, data.bookingType);
    const totalAmount = computeTotalAmount(unitPrice, window.units);

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", context.userId)
      .maybeSingle();

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

    const { data: row, error } = await supabase.from("bookings").insert({
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
      status: "pending",
      payment_status: "unpaid",
      full_name: profile?.full_name ?? "",
      phone: profile?.phone ?? "",
      note: data.note,
    }).select(
      "id, code, desk_code, booking_type, start_at, end_at, units, unit_price, total_amount, status, payment_status",
    ).single();

    if (error) throw new Error("ثبت رزرو ناموفق بود.");
    return row;
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
    return data ?? [];
  });

