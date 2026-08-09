/**
 * SMS delivery for OTP. Configure Kavenegar via env vars.
 * Falls back to console log when SMS_API_KEY is not set (MVP demo mode).
 */

export async function sendOtpSms(phone: string, code: string): Promise<boolean> {
  const apiKey = process.env.KAVENEGAR_API_KEY;
  const template = process.env.KAVENEGAR_OTP_TEMPLATE ?? "verify";
  const receptor = phone.replace("+98", "0");

  if (!apiKey) {
    console.info(`[SMS demo] OTP for ${phone}: ${code}`);
    return false;
  }

  const url = new URL(`https://api.kavenegar.com/v1/${apiKey}/verify/lookup.json`);
  url.searchParams.set("receptor", receptor);
  url.searchParams.set("token", code);
  url.searchParams.set("template", template);

  const res = await fetch(url.toString(), { method: "POST" });
  if (!res.ok) {
    const body = await res.text();
    console.error("[SMS] Kavenegar error:", body);
    throw new Error("ارسال پیامک ناموفق بود.");
  }
  return true;
}

export function isSmsConfigured(): boolean {
  return Boolean(process.env.KAVENEGAR_API_KEY);
}
