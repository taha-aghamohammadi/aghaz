import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { expireStalePendingBookings, requireStaff } from "@/lib/booking.service";

export const getWalletBalance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("wallets")
      .select("balance, currency, updated_at")
      .eq("user_id", context.userId)
      .maybeSingle();

    return {
      balance: data?.balance ?? 0,
      currency: data?.currency ?? "IRT",
      updatedAt: data?.updated_at ?? null,
    };
  });

export const payBookingFromWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ bookingId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: booking, error: bookingErr } = await context.supabase
      .from("bookings")
      .select("id, code, user_id, total_amount, payment_status, status, created_at")
      .eq("id", data.bookingId)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (bookingErr || !booking) throw new Error("رزرو پیدا نشد.");
    await expireStalePendingBookings(booking);
    const { data: effective, error: effErr } = await context.supabase
      .from("bookings")
      .select("payment_status, status")
      .eq("id", data.bookingId)
      .maybeSingle();
    if (effErr || !effective) throw new Error("رزرو پیدا نشد.");
    if (effective.payment_status === "paid") throw new Error("این رزرو قبلاً پرداخت شده است.");
    if (effective.status === "cancelled") throw new Error("رزرو لغوشده قابل پرداخت نیست.");

    const amount = booking.total_amount;
    const { data: wallet } = await supabaseAdmin
      .from("wallets")
      .select("balance")
      .eq("user_id", context.userId)
      .maybeSingle();

    const balance = wallet?.balance ?? 0;
    if (balance < amount) throw new Error("موجودی کیف پول کافی نیست.");

    const newBalance = balance - amount;

    await supabaseAdmin.from("wallets").upsert({
      user_id: context.userId,
      balance: newBalance,
      updated_at: new Date().toISOString(),
    });

    await supabaseAdmin.from("wallet_transactions").insert({
      wallet_user_id: context.userId,
      kind: "debit",
      amount,
      balance_after: newBalance,
      description: `پرداخت رزرو ${booking.code}`,
      booking_id: booking.id,
    });

    await supabaseAdmin
      .from("bookings")
      .update({ payment_status: "paid", status: "confirmed" })
      .eq("id", booking.id);

    return { ok: true, balance: newBalance };
  });

export const adjustWalletBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        amount: z.number().int(),
        description: z.string().trim().max(160).optional().default("تعدیل توسط مدیر"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: wallet } = await supabaseAdmin
      .from("wallets")
      .select("balance")
      .eq("user_id", data.userId)
      .maybeSingle();

    const balance = wallet?.balance ?? 0;
    const newBalance = balance + data.amount;
    if (newBalance < 0) throw new Error("موجودی نمی‌تواند منفی شود.");

    await supabaseAdmin.from("wallets").upsert({
      user_id: data.userId,
      balance: newBalance,
      updated_at: new Date().toISOString(),
    });

    await supabaseAdmin.from("wallet_transactions").insert({
      wallet_user_id: data.userId,
      kind: data.amount >= 0 ? "credit" : "debit",
      amount: Math.abs(data.amount),
      balance_after: newBalance,
      description: data.description,
    });

    return { ok: true, balance: newBalance };
  });

export const listWalletTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("wallet_transactions")
      .select("id, kind, amount, balance_after, description, created_at, booking_id")
      .eq("wallet_user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    return data ?? [];
  });
