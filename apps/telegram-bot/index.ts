/**
 * Telegram bot for آغاز — link account, receive notifications, pick channel.
 * Run: node --import tsx apps/telegram-bot/index.ts
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../src/integrations/supabase/types";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("TELEGRAM_BOT_TOKEN is required");
  process.exit(1);
}

const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type TgUpdate = {
  update_id: number;
  message?: { text?: string; chat: { id: number }; from?: { id: number } };
};

async function tg(method: string, body: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function send(chatId: number, text: string) {
  await tg("sendMessage", { chat_id: chatId, text });
}

async function handleLinkToken(chatId: number, fromId: number, linkToken: string) {
  const { data: link } = await supabase
    .from("telegram_link_tokens")
    .select("user_id")
    .eq("token", linkToken)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (!link) {
    await send(
      chatId,
      "لینک اتصال نامعتبر یا منقضی شده است. از صفحه «حساب من» دوباره یک لینک جدید بسازید.",
    );
    return;
  }

  await supabase
    .from("profiles")
    .update({ telegram_id: fromId, telegram_linked_at: new Date().toISOString() })
    .eq("id", link.user_id);
  await supabase
    .from("telegram_link_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("token", linkToken);

  await send(
    chatId,
    "✅ حساب شما به تلگرام متصل شد. از این پس کدها و اعلان‌ها اینجا ارسال می‌شوند.",
  );
}

async function handlePref(chatId: number, fromId: number, choice: string | undefined) {
  if (choice !== "sms" && choice !== "telegram") {
    await send(chatId, "نحوه دریافت اعلان را انتخاب کنید:\n/pref telegram\n/pref sms");
    return;
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("telegram_id", fromId)
    .maybeSingle();
  if (!profile) {
    await send(chatId, "ابتدا حساب را از صفحه «حساب من» متصل کنید.");
    return;
  }
  await supabase.from("profiles").update({ notification_pref: choice }).eq("id", profile.id);
  await send(chatId, choice === "telegram" ? "کانال اعلان: تلگرام ✅" : "کانال اعلان: پیامک");
}

async function handleMessage(chatId: number, text: string, fromId: number) {
  const parts = text.trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase();

  if (cmd === "/start") {
    if (parts[1]) {
      await handleLinkToken(chatId, fromId, parts[1]);
      return;
    }
    await send(
      chatId,
      "سلام! به ربات آغاز خوش آمدید.\nحساب خود را از صفحه «حساب من» در وب‌سایت آغاز متصل کنید.\n\n/pref telegram — اعلان در تلگرام\n/pref sms — اعلان با پیامک\n/my — رزروهای من\n/help — راهنما",
    );
    return;
  }

  if (cmd === "/help") {
    await send(chatId, "دستورات: /start /pref /my /help");
    return;
  }

  if (cmd === "/pref") {
    await handlePref(chatId, fromId, parts[1]?.toLowerCase());
    return;
  }

  if (cmd === "/my") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("telegram_id", fromId)
      .maybeSingle();

    if (!profile) {
      await send(chatId, "ابتدا حساب را از صفحه «حساب من» متصل کنید.");
      return;
    }

    const { data: bookings } = await supabase
      .from("bookings")
      .select("code, desk_code, status, payment_status, start_at")
      .eq("user_id", profile.id)
      .order("start_at", { ascending: false })
      .limit(10);

    if (!bookings?.length) {
      await send(chatId, "رزروی ثبت نشده است.");
      return;
    }

    const lines = bookings.map(
      (b) => `${b.code} · میز ${b.desk_code} · ${b.status} · ${b.payment_status}`,
    );
    await send(chatId, lines.join("\n"));
    return;
  }

  await send(chatId, "دستور ناشناخته. /help");
}

let lastUpdateId = 0;

async function poll() {
  const res = await tg("getUpdates", { timeout: 30, offset: lastUpdateId + 1 });
  const updates = (res as { result?: TgUpdate[] }).result ?? [];
  for (const u of updates) {
    if (u.update_id > lastUpdateId) lastUpdateId = u.update_id;
    const msg = u.message;
    if (!msg?.text || !msg.from) continue;
    await handleMessage(msg.chat.id, msg.text, msg.from.id);
  }
}

console.info("[telegram-bot] polling...");

while (true) {
  try {
    await poll();
  } catch (e) {
    console.error("[telegram-bot] error", e);
    await new Promise((r) => setTimeout(r, 5000));
  }
}
