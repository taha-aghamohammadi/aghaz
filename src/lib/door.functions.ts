import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DOOR_TOKEN_TTL_MS = 60_000;

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const requestDoorUnlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ deviceId: z.string().trim().max(40).optional().default("main-door") }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();

    const { data: bookings } = await context.supabase
      .from("bookings")
      .select("id, code, start_at, end_at, status, payment_status")
      .eq("user_id", context.userId)
      .eq("status", "confirmed")
      .eq("payment_status", "paid")
      .lte("start_at", now)
      .gte("end_at", now)
      .order("start_at", { ascending: false })
      .limit(1);

    const active = bookings?.[0];
    if (!active) {
      await supabaseAdmin.from("door_events").insert({
        user_id: context.userId,
        device_id: data.deviceId,
        result: "denied_no_booking",
        token_hash: "",
      });
      throw new Error("رزرو فعال و تأیید‌شده برای باز کردن درب وجود ندارد.");
    }

    const tokenBytes = new Uint8Array(16);
    crypto.getRandomValues(tokenBytes);
    const token = Array.from(tokenBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const tokenHash = await hashToken(token);
    const expiresAt = new Date(Date.now() + DOOR_TOKEN_TTL_MS).toISOString();

    await supabaseAdmin.from("door_events").insert({
      user_id: context.userId,
      booking_id: active.id,
      device_id: data.deviceId,
      result: "token_issued",
      token_hash: tokenHash,
    });

    return {
      token,
      expiresAt,
      bookingCode: active.code,
      deviceId: data.deviceId,
    };
  });

export const verifyDoorUnlockToken = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        token: z.string().trim().min(16).max(64),
        deviceId: z.string().trim().max(40),
        deviceKey: z.string().trim().min(8).max(128),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const expectedKey = process.env.DOOR_DEVICE_API_KEY;
    if (!expectedKey || data.deviceKey !== expectedKey) {
      throw new Error("دستگاه مجاز نیست.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tokenHash = await hashToken(data.token);
    const since = new Date(Date.now() - DOOR_TOKEN_TTL_MS).toISOString();

    const { data: event } = await supabaseAdmin
      .from("door_events")
      .select("id, user_id, booking_id, device_id, result, created_at")
      .eq("token_hash", tokenHash)
      .eq("device_id", data.deviceId)
      .eq("result", "token_issued")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!event) {
      await supabaseAdmin.from("door_events").insert({
        device_id: data.deviceId,
        result: "denied_invalid_token",
        token_hash: tokenHash,
      });
      throw new Error("توکن نامعتبر یا منقضی شده است.");
    }

    await supabaseAdmin.from("door_events").insert({
      user_id: event.user_id,
      booking_id: event.booking_id,
      device_id: data.deviceId,
      result: "unlocked",
      token_hash: tokenHash,
    });

    return { ok: true, unlock: true };
  });
