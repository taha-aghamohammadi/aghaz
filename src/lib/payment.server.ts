/**
 * Zarinpal payment gateway integration (sandbox-friendly).
 */

const ZARINPAL_SANDBOX = process.env.ZARINPAL_SANDBOX === "true" || !process.env.ZARINPAL_MERCHANT_ID;
const ZARINPAL_MERCHANT = process.env.ZARINPAL_MERCHANT_ID ?? "00000000-0000-0000-0000-000000000000";

const REQUEST_URL = ZARINPAL_SANDBOX
  ? "https://sandbox.zarinpal.com/pg/v4/payment/request.json"
  : "https://api.zarinpal.com/pg/v4/payment/request.json";

const VERIFY_URL = ZARINPAL_SANDBOX
  ? "https://sandbox.zarinpal.com/pg/v4/payment/verify.json"
  : "https://api.zarinpal.com/pg/v4/payment/verify.json";

const START_PAY_URL = ZARINPAL_SANDBOX
  ? "https://sandbox.zarinpal.com/pg/StartPay/"
  : "https://www.zarinpal.com/pg/StartPay/";

export async function createZarinpalPayment(input: {
  amount: number;
  description: string;
  callbackUrl: string;
  metadata?: Record<string, string>;
}): Promise<{ authority: string; paymentUrl: string }> {
  const res = await fetch(REQUEST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      merchant_id: ZARINPAL_MERCHANT,
      amount: input.amount,
      description: input.description,
      callback_url: input.callbackUrl,
      metadata: input.metadata ?? {},
    }),
  });

  const json = (await res.json()) as {
    data?: { authority?: string; code?: number; message?: string };
    errors?: { message?: string }[];
  };

  const authority = json.data?.authority;
  if (!authority) {
    const msg = json.errors?.[0]?.message ?? json.data?.message ?? "درخواست پرداخت ناموفق بود.";
    throw new Error(msg);
  }

  return { authority, paymentUrl: `${START_PAY_URL}${authority}` };
}

export async function verifyZarinpalPayment(input: {
  authority: string;
  amount: number;
}): Promise<{ refId: string; ok: boolean }> {
  const res = await fetch(VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      merchant_id: ZARINPAL_MERCHANT,
      amount: input.amount,
      authority: input.authority,
    }),
  });

  const json = (await res.json()) as {
    data?: { code?: number; ref_id?: number };
    errors?: { message?: string }[];
  };

  const code = json.data?.code;
  if (code === 100 || code === 101) {
    return { refId: String(json.data?.ref_id ?? ""), ok: true };
  }

  const msg = json.errors?.[0]?.message ?? "تأیید پرداخت ناموفق بود.";
  throw new Error(msg);
}

export function isPaymentConfigured(): boolean {
  return Boolean(process.env.ZARINPAL_MERCHANT_ID) || ZARINPAL_SANDBOX;
}

export async function processPaymentCallback(input: {
  authority?: string;
  status?: string;
}): Promise<{ ok: boolean; message: string; refId?: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  if (!input.authority || input.status !== "OK") {
    return { ok: false, message: "پرداخت لغو شد یا ناموفق بود." };
  }

  const { data: order, error: orderErr } = await supabaseAdmin
    .from("payment_orders")
    .select("id, booking_id, user_id, amount, status")
    .eq("authority", input.authority)
    .maybeSingle();

  if (orderErr || !order) throw new Error("سفارش پرداخت پیدا نشد.");
  if (order.status === "paid") return { ok: true, message: "پرداخت قبلاً تأیید شده است." };

  const { refId, ok } = await verifyZarinpalPayment({
    authority: input.authority,
    amount: order.amount,
  });

  if (!ok) return { ok: false, message: "تأیید پرداخت ناموفق بود." };

  await supabaseAdmin
    .from("payment_orders")
    .update({ status: "paid", ref_id: refId })
    .eq("id", order.id);

  if (order.booking_id) {
    await supabaseAdmin
      .from("bookings")
      .update({ payment_status: "paid", status: "confirmed" })
      .eq("id", order.booking_id);
  }

  return { ok: true, message: "پرداخت با موفقیت انجام شد.", refId };
}
