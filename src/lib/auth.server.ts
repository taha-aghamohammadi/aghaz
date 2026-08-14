// Server-only helpers for phone + OTP authentication.

import { toEnDigits, normalizeNationalId } from "@/lib/national-id";

export { normalizeNationalId };

/** Returns a normalized E.164 Iranian mobile number, or null when invalid. */
export function normalizePhone(raw: string): string | null {
  let digits = toEnDigits(raw).replace(/\D/g, "");
  if (digits.startsWith("0098")) digits = digits.slice(4);
  else if (digits.startsWith("98")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = digits.slice(1);
  if (!/^9\d{9}$/.test(digits)) return null;
  return `+98${digits}`;
}

export function phoneToEmail(phone: string): string {
  return `${phone.replace("+", "")}@phone.hayat.space`;
}

export function generateCode(): string {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(1000 + (bytes[0]! % 9000));
}

export async function hashCode(phone: string, code: string): Promise<string> {
  const data = new TextEncoder().encode(`${phone}:${code}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export type SignupDetails = {
  fullName: string | null;
  nationalId?: string | null;
  jobTitle?: string | null;
  education?: string | null;
};

export type ProfileRegistrationRow = {
  full_name?: string | null;
  national_id?: string | null;
};

/** A profile counts as registered when signup fields were completed previously. */
export function isRegisteredProfile(profile: ProfileRegistrationRow | null | undefined): boolean {
  if (!profile) return false;
  const name = (profile.full_name ?? "").trim();
  const nationalId = (profile.national_id ?? "").replace(/\D/g, "");
  return name.length >= 3 && nationalId.length === 10;
}

export async function createOtp(phone: string, details: SignupDetails) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const code = generateCode();
  const { error } = await supabaseAdmin.from("phone_otps").insert({
    phone,
    code_hash: await hashCode(phone, code),
    full_name: details.fullName,
    national_id: details.nationalId ?? null,
    job_title: details.jobTitle ?? null,
    education: details.education ?? null,
    expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
  });
  if (error) {
    console.error("[OTP] insert failed:", error.message, error.code, error.details);
    throw new Error("ثبت کد یکبار مصرف ناموفق بود.");
  }
  return code;
}

export async function consumeOtp(phone: string, code: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row, error } = await supabaseAdmin
    .from("phone_otps")
    .select(
      "id, code_hash, full_name, national_id, job_title, education, attempts, expires_at, consumed_at",
    )
    .eq("phone", phone)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error("بررسی کد ناموفق بود.");
  if (!row) throw new Error("کدی برای این شماره پیدا نشد. دوباره درخواست کنید.");
  if (new Date(row.expires_at).getTime() < Date.now())
    throw new Error("کد منقضی شده است. کد جدید بگیرید.");
  if (row.attempts >= MAX_ATTEMPTS)
    throw new Error("تعداد تلاش‌ها زیاد بود. کد جدید بگیرید.");

  const matches = row.code_hash === (await hashCode(phone, code));
  if (!matches) {
    await supabaseAdmin
      .from("phone_otps")
      .update({ attempts: row.attempts + 1 })
      .eq("id", row.id);
    throw new Error("کد وارد‌شده درست نیست.");
  }

  await supabaseAdmin
    .from("phone_otps")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", row.id);

  return {
    fullName: row.full_name ?? "",
    nationalId: row.national_id ?? "",
    jobTitle: row.job_title ?? "",
    education: row.education ?? "",
  };
}

/** Creates the account when needed and returns a one-time login token hash. */
export async function issueSessionToken(
  phone: string,
  details: { fullName: string; nationalId: string; jobTitle: string; education: string },
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const email = phoneToEmail(phone);

  const { error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
    phone_confirm: false,
    user_metadata: { full_name: details.fullName, phone },
  });
  if (createErr && !/already|registered|exists|duplicate/i.test(createErr.message)) {
    throw new Error("ایجاد حساب کاربری ناموفق بود.");
  }

  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error || !data?.properties?.email_otp || !data.user) {
    throw new Error("ایجاد نشست ورود ناموفق بود.");
  }

  const existing = await supabaseAdmin
    .from("profiles")
    .select("full_name, national_id, job_title, education")
    .eq("id", data.user.id)
    .maybeSingle();

  await supabaseAdmin.from("profiles").upsert({
    id: data.user.id,
    full_name: details.fullName || existing.data?.full_name || "",
    national_id: details.nationalId || existing.data?.national_id || "",
    job_title: details.jobTitle || existing.data?.job_title || "",
    education: details.education || existing.data?.education || "",
    phone,
  });

  return { emailOtp: data.properties.email_otp, email };
}

