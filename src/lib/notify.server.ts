/**
 * Channel-aware notification delivery.
 * Default channel is Telegram; falls back to SMS when the user isn't linked
 * or Telegram delivery fails. Users on the "sms" preference skip Telegram.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendApprovalSms, sendBookingSms, sendOtpSms } from "@/lib/sms.server";

export type NotificationKind = "otp" | "approval" | "booking";
export type DeliveryChannel = "telegram" | "sms" | "none";

const TELEGRAM_API = "https://api.telegram.org";

/** Default channel for users with no preference set. Configurable via env. */
export function defaultChannel(): DeliveryChannel {
  return process.env.NOTIFICATION_DEFAULT_CHANNEL === "sms" ? "sms" : "telegram";
}

export async function sendTelegramMessage(chatId: number, text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    // Telegram answers 200 with body.ok=false (e.g. 403 "can't initiate
    // conversation") — treat that as failure so SMS fallback kicks in.
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean };
    if (!res.ok || body.ok === false) {
      console.error("[notify] Telegram send failed:", res.status);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[notify] Telegram send error:", e);
    return false;
  }
}

/** Attempt order for a user. Pure so it can be checked without a DB. */
export function deliveryOrder(pref: string | null, telegramId: number | null): DeliveryChannel[] {
  const wantTelegram = (pref ?? defaultChannel()) === "telegram";
  if (wantTelegram && telegramId) return ["telegram", "sms"];
  return ["sms"];
}

export async function notifyUser(input: {
  supabase: SupabaseClient;
  userId?: string | null;
  phone?: string | null;
  kind: NotificationKind;
  text: string;
  otpCode?: string;
  approval?: { username: string; hour: string; day: string };
  booking?: { code: string; status: string; type: string };
}): Promise<{ channel: DeliveryChannel; sent: boolean }> {
  const { supabase } = input;

  let profile: {
    id: string;
    phone: string | null;
    telegram_id: number | null;
    notification_pref: string | null;
  } | null = null;
  const query = supabase.from("profiles").select("id, phone, telegram_id, notification_pref");
  if (input.userId) {
    const { data } = await query.eq("id", input.userId).maybeSingle();
    profile = data ?? null;
  } else if (input.phone) {
    const { data } = await query.eq("phone", input.phone).maybeSingle();
    profile = data ?? null;
  }

  const targetPhone = profile?.phone ?? input.phone ?? null;
  const pref = profile?.notification_pref ?? defaultChannel();

  for (const channel of deliveryOrder(pref, profile?.telegram_id ?? null)) {
    if (channel === "telegram") {
      const ok = await sendTelegramMessage(profile!.telegram_id!, input.text);
      if (ok) return { channel: "telegram", sent: true };
      console.warn("[notify] Telegram failed, falling back to SMS");
      continue;
    }

    if (channel === "sms") {
      if (!targetPhone) break;
      let smsOk = false;
      if (input.kind === "otp" && input.otpCode) {
        smsOk = await sendOtpSms(targetPhone, input.otpCode);
      } else if (input.kind === "approval" && input.approval) {
        smsOk = await sendApprovalSms({ phone: targetPhone, ...input.approval });
      } else if (input.kind === "booking" && input.booking) {
        smsOk = await sendBookingSms({ phone: targetPhone, ...input.booking });
      }
      return { channel: smsOk ? "sms" : "none", sent: smsOk };
    }
  }

  return { channel: "none", sent: false };
}
