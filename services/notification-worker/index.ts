/**
 * Notification delivery worker.
 * Run: node --import tsx services/notification-worker/index.ts
 *
 * Polls pending notifications and marks them sent (web channel logs;
 * telegram channel requires TELEGRAM_BOT_TOKEN and linked profiles).
 */

import { createClient } from "@supabase/supabase-js";

const POLL_MS = 15_000;

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

async function sendTelegram(chatId: number, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  return res.ok;
}

async function tick(supabase: ReturnType<typeof createClient>) {
  const { data: rows } = await supabase
    .from("notifications")
    .select("id, user_id, channel, type, payload")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(50);

  for (const row of rows ?? []) {
    let delivered = false;

    if (row.channel === "web") {
      console.info(`[notify:web] user=${row.user_id} type=${row.type}`);
      delivered = true;
    }

    if (row.channel === "telegram" && row.user_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("telegram_id")
        .eq("id", row.user_id)
        .maybeSingle();
      if (profile?.telegram_id) {
        const payload = row.payload as { code?: string; status?: string };
        const text = `آغاز: ${row.type}\nکد: ${payload.code ?? ""}\nوضعیت: ${payload.status ?? ""}`;
        delivered = await sendTelegram(profile.telegram_id, text);
      }
    }

    if (delivered) {
      await supabase
        .from("notifications")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", row.id);
    }
  }
}

async function main() {
  const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
  console.info("[notification-worker] started");
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await tick(supabase);
    } catch (e) {
      console.error("[notification-worker] error", e);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
