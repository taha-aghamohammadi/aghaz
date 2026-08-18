import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const requestSchema = z.object({
  phone: z.string().trim().min(8).max(20),
  channel: z.enum(["sms", "telegram"]).optional(),
});

const verifySchema = z.object({
  phone: z.string().trim().min(8).max(20),
  code: z.string().trim().min(4).max(8),
});

const profileSchema = z.object({
  fullName: z.string().trim().min(3, "نام و نام خانوادگی را کامل وارد کنید.").max(80),
  nationalId: z.string().trim().max(20).optional().default(""),
  jobTitle: z.string().trim().max(80).optional().default(""),
  education: z.string().trim().max(80).optional().default(""),
});

export const requestPhoneOtp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => requestSchema.parse(input))
  .handler(async ({ data }) => {
    const { normalizePhone, phoneToEmail, createOtp } = await import("@/lib/auth.server");
    const phone = normalizePhone(data.phone);
    if (!phone) throw new Error("شماره موبایل معتبر نیست (مثال: ۰۹۱۲۱۲۳۴۵۶۷).");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, national_id, telegram_id")
      .eq("phone", phone)
      .maybeSingle();

    const code = await createOtp(phone, {
      fullName: existing?.full_name ?? null,
      nationalId: null,
      jobTitle: null,
      education: null,
    });

    const { notifyUser } = await import("@/lib/notify.server");
    let channel: "telegram" | "sms" | "none" = "none";
    let smsSent = false;
    try {
      const result = await notifyUser({
        supabase: supabaseAdmin,
        phone,
        kind: "otp",
        text: `کد ورود شما به آغاز: ${code}`,
        otpCode: code,
        force: data.channel,
      });
      smsSent = result.sent;
      channel = result.channel;
    } catch (e) {
      console.error("[OTP] send failed:", e);
    }

    const isDev = process.env.NODE_ENV !== "production";
    const demoMode = process.env.OTP_DEMO_MODE === "true";
    const showDemoCode = !smsSent && (isDev || demoMode);

    return {
      phone,
      isNewUser: !existing,
      maskedEmail: phoneToEmail(phone),
      smsSent,
      telegramLinked: !!existing?.telegram_id,
      channel,
      demoMode: showDemoCode,
      demoCode: showDemoCode ? code : undefined,
    };
  });

export const verifyPhoneOtp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => verifySchema.parse(input))
  .handler(async ({ data }) => {
    const { normalizePhone, consumeOtp, issueSessionToken, isRegisteredProfile } =
      await import("@/lib/auth.server");
    const phone = normalizePhone(data.phone);
    if (!phone) throw new Error("شماره موبایل معتبر نیست.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, national_id, telegram_id")
      .eq("phone", phone)
      .maybeSingle();

    const registered = isRegisteredProfile(existingProfile);
    const details = await consumeOtp(phone, data.code);
    const session = await issueSessionToken(phone, details);

    return {
      registered,
      telegramLinked: !!existingProfile?.telegram_id,
      emailOtp: session.emailOtp,
      email: session.email,
    };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => profileSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { normalizeNationalId } = await import("@/lib/national-id");
    let nationalId = "";
    if (data.nationalId) {
      const normalized = normalizeNationalId(data.nationalId);
      if (!normalized) throw new Error("کد ملی معتبر نیست.");
      nationalId = normalized;
    }

    const { error } = await context.supabase
      .from("profiles")
      .update({
        full_name: data.fullName,
        national_id: nationalId,
        job_title: data.jobTitle,
        education: data.education,
      })
      .eq("id", context.userId);
    if (error) throw new Error("ذخیره اطلاعات ناموفق بود.");
    return { ok: true };
  });
