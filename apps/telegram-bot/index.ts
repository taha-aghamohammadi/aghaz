/**
 * Telegram bot for آغاز — link account, list bookings, receive notifications.
 * Run: node --import tsx apps/telegram-bot/index.ts
 */

import { createClient } from "@supabase/supabase-js";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("TELEGRAM_BOT_TOKEN is required");
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type TgUpdate = {
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

async function handleMessage(chatId: number, text: string, fromId: number) {
  const parts = text.trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase();

  if (cmd === "/start") {
    await send(
      chatId,
      "سلام! به ربات آغاز خوش آمدید.\n/link <کد-۶-رقمی> — اتصال حساب\n/my — رزروهای من\n/help — راهنما",
    );
    return;
  }

  if (cmd === "/help") {
    await send(chatId, "دستورات: /start /link /my /help");
    return;
  }

  if (cmd === "/link") {
    const code = parts[1];
    if (!code || code.length < 4) {
      await send(chatId, "کد اتصال را وارد کنید: /link 123456");
      return;
    }
    const { data: otp } = await supabase
      .from("phone_otps")
      .select("phone")
      .eq("code_hash", code)
      .limit(1)
      .maybeSingle();

    if (!otp?.phone) {
      await send(chatId, "کد نامعتبر است. از وب‌سایت کد OTP فعال را وارد کنید یا با پشتیبانی تماس بگیرید.");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("phone", otp.phone)
      .maybeSingle();

    if (!profile) {
      await send(chatId, "حساب کاربری برای این شماره پیدا نشد.");
      return;
    }

    await supabase
      .from("profiles")
      .update({ telegram_id: fromId, telegram_linked_at: new Date().toISOString() })
      .eq("id", profile.id);

    await send(chatId, "حساب شما با موفقیت متصل شد.");
    return;
  }

  if (cmd === "/my") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("telegram_id", fromId)
      .maybeSingle();

    if (!profile) {
      await send(chatId, "ابتدا حساب را با /link متصل کنید.");
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

async function poll() {
  const res = await tg("getUpdates", { timeout: 30 });
  const updates = (res as { result?: TgUpdate[] }).result ?? [];
  for (const u of updates) {
    const msg = u.message;
    if (!msg?.text || !msg.from) continue;
    await handleMessage(msg.chat.id, msg.text, msg.from.id);
  }
}

console.info("[telegram-bot] polling...");
// eslint-disable-next-line no-constant-condition
while (true) {
  try {
    await poll();
  } catch (e) {
    console.error("[telegram-bot] error", e);
    await new Promise((r) => setTimeout(r, 5000));
  }
}
