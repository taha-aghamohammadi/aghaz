import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TELEGRAM_LINK_TTL_MS = 15 * 60 * 1000;

/** One-time deep link so the bot can bind this profile to a chat. */
export const createTelegramLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const username = process.env.TELEGRAM_BOT_USERNAME;
    if (!username) throw new Error("ربات تلگرام پیکربندی نشده است.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // a fresh link makes any previous unused one useless
    await supabaseAdmin
      .from("telegram_link_tokens")
      .delete()
      .eq("user_id", context.userId)
      .is("used_at", null);

    const token = randomBytes(16).toString("hex");
    const { error } = await supabaseAdmin.from("telegram_link_tokens").insert({
      token,
      user_id: context.userId,
      expires_at: new Date(Date.now() + TELEGRAM_LINK_TTL_MS).toISOString(),
    });
    if (error) throw new Error("ایجاد لینک اتصال ناموفق بود.");

    return { url: `https://t.me/${username}?start=${token}` };
  });

/** Switch the default notification channel for a user. */
export const updateNotificationPref = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ pref: z.enum(["telegram", "sms"]) }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ notification_pref: data.pref })
      .eq("id", context.userId);
    if (error) throw new Error("ذخیره تنظیمات اعلان ناموفق بود.");
    return { ok: true };
  });
