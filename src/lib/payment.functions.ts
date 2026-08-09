import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createZarinpalPayment, processPaymentCallback, verifyZarinpalPayment } from "@/lib/payment.server";

function paymentCallbackUrl(): string {
  const site = process.env.SITE_URL ?? process.env.VITE_SITE_URL ?? "http://localhost:8080";
  return `${site.replace(/\/$/, "")}/api/payment/callback`;
}

export const createBookingPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ bookingId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: booking, error } = await context.supabase
      .from("bookings")
      .select("id, code, user_id, total_amount, payment_status, status")
      .eq("id", data.bookingId)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (error || !booking) throw new Error("رزرو پیدا نشد.");
    if (booking.payment_status === "paid") throw new Error("این رزرو قبلاً پرداخت شده است.");
    if (booking.status === "cancelled") throw new Error("رزرو لغوشده قابل پرداخت نیست.");

    const amount = booking.total_amount;
    if (amount <= 0) throw new Error("مبلغ رزرو نامعتبر است.");

    const { authority, paymentUrl } = await createZarinpalPayment({
      amount,
      description: `رزرو آغاز · ${booking.code}`,
      callbackUrl: paymentCallbackUrl(),
      metadata: { booking_id: booking.id, user_id: context.userId },
    });

    const { error: orderErr } = await supabaseAdmin.from("payment_orders").insert({
      booking_id: booking.id,
      user_id: context.userId,
      amount,
      authority,
      gateway: "zarinpal",
      status: "pending",
    });

    if (orderErr) throw new Error("ثبت سفارش پرداخت ناموفق بود.");
    return { paymentUrl, authority };
  });

export const handlePaymentCallback = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z
      .object({
        Authority: z.string().optional(),
        Status: z.string().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => processPaymentCallback({ authority: data.Authority, status: data.Status }));
