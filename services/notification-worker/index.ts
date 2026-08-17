/**
 * Notification delivery worker.
 * Run: node --import tsx services/notification-worker/index.ts
 *
 * Polls pending notifications and delivers them via the shared channel-aware
 * layer (Telegram first, SMS fallback). Undeliverable rows are logged and
 * marked sent — best-effort, notifications never block the queue.
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../src/integrations/supabase/types";
import { notifyUser } from "../../src/lib/notify.server";

const POLL_MS = 15_000;

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

async function tick(supabase: ReturnType<typeof createClient<Database>>) {
  const { data: rows } = await supabase
    .from("notifications")
    .select("id, user_id, type, payload")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(50);

  for (const row of rows ?? []) {
    const payload = row.payload as { code?: string; status?: string };
    const text = `آغاز: ${row.type}\nکد: ${payload.code ?? ""}\nوضعیت: ${payload.status ?? ""}`;
    const { sent } = await notifyUser({
      supabase,
      userId: row.user_id,
      kind: "booking",
      text,
      booking: {
        code: payload.code ?? "",
        status: payload.status ?? "",
        type: row.type,
      },
    });

    if (!sent) {
      console.info(`[notify:web] user=${row.user_id} type=${row.type}`);
    }
    await supabase
      .from("notifications")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", row.id);
  }
}

async function main() {
  const supabase = createClient<Database>(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
  console.info("[notification-worker] started");

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
