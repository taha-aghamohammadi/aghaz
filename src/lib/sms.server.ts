/**
 * SMS delivery for OTP. Limosms is the primary provider (pattern message),
 * Kavenegar is a fallback. Falls back to console log when no provider is
 * configured (MVP demo mode).
 */

function toZeroPrefix(phone: string): string {
  const digits = phone.replace("+98", "0");
  return digits.startsWith("0") ? digits : `0${digits}`;
}

async function sendLimosmsTokens(phone: string, otpId: number, tokens: string[]): Promise<boolean> {
  const apiKey = process.env.LIMOSMS_API_KEY;
  if (!apiKey) return false;
  if (!Number.isFinite(otpId)) throw new Error("شناسه پیامک نامعتبر است.");

  const res = await fetch("https://api.limosms.com/api/sendpatternmessage", {
    method: "POST",
    headers: { "Content-Type": "application/json", ApiKey: apiKey },
    body: JSON.stringify({
      OtpId: otpId,
      ReplaceToken: tokens,
      MobileNumber: toZeroPrefix(phone),
      Send: true,
    }),
  });

  type LimosmsResponse = { Success?: boolean; Message?: string; TotalAmount?: number };
  let body: LimosmsResponse | undefined;
  try {
    body = (await res.json()) as LimosmsResponse;
  } catch {
    // non-JSON body
  }

  if (!res.ok || !body?.Success) {
    console.error("[SMS] Limosms error:", res.status, body?.Message ?? "");
    throw new Error("ارسال پیامک ناموفق بود.");
  }
  console.info(`[SMS] Limosms sent to ${phone}, cost=${body.TotalAmount}`);
  return true;
}

async function sendLimosms(phone: string, code: string): Promise<boolean> {
  return sendLimosmsTokens(phone, Number(process.env.LIMOSMS_OTP_ID ?? 2964), [code]);
}

async function sendKavenegar(phone: string, code: string): Promise<boolean> {
  const apiKey = process.env.KAVENEGAR_API_KEY;
  if (!apiKey) return false;

  const template = process.env.KAVENEGAR_OTP_TEMPLATE ?? "verify";
  const url = new URL(`https://api.kavenegar.com/v1/${apiKey}/verify/lookup.json`);
  url.searchParams.set("receptor", toZeroPrefix(phone));
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

export async function sendOtpSms(phone: string, code: string): Promise<boolean> {
  try {
    const sent = await sendLimosms(phone, code);
    if (sent) return true;
  } catch (e) {
    console.error("[SMS] Limosms failed, trying Kavenegar:", e);
  }

  try {
    const sent = await sendKavenegar(phone, code);
    if (sent) return true;
  } catch (e) {
    console.error("[SMS] Kavenegar failed:", e);
  }

  console.info(`[SMS demo] OTP for ${phone}: ${code}`);
  return false;
}

export function isSmsConfigured(): boolean {
  return Boolean(process.env.LIMOSMS_API_KEY) || Boolean(process.env.KAVENEGAR_API_KEY);
}

/**
 * Approval SMS for card-transfer payments, pattern 2966:
 *   {0} عزیز/ آغاز در ساعت {1} از روز {2} میزبان شماست
 * Best-effort: failures are logged but never roll back the approval.
 */
export async function sendApprovalSms(input: {
  phone: string;
  username: string;
  hour: string;
  day: string;
}): Promise<boolean> {
  try {
    const sent = await sendLimosmsTokens(
      input.phone,
      Number(process.env.LIMOSMS_APPROVAL_OTP_ID ?? 2966),
      [input.username, input.hour, input.day],
    );
    if (sent) return true;
  } catch (e) {
    console.error("[SMS] Limosms approval failed:", e);
  }
  console.info(
    `[SMS demo] approval for ${input.phone}: ${input.username} ${input.hour} ${input.day}`,
  );
  return false;
}

/**
 * Booking status SMS, pattern LIMOSMS_BOOKING_OTP_ID (optional — set in env
 * once the pattern is defined in Limosms). Best-effort; demo logs otherwise.
 */
export async function sendBookingSms(input: {
  phone: string;
  code: string;
  status: string;
  type: string;
}): Promise<boolean> {
  const otpId = Number(process.env.LIMOSMS_BOOKING_OTP_ID);
  if (!Number.isFinite(otpId)) {
    console.info(
      `[SMS demo] booking for ${input.phone}: ${input.type} ${input.code} ${input.status}`,
    );
    return false;
  }
  try {
    const sent = await sendLimosmsTokens(input.phone, otpId, [input.code, input.status]);
    if (sent) return true;
  } catch (e) {
    console.error("[SMS] Limosms booking failed:", e);
  }
  return false;
}
