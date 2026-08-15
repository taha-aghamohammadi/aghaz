import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { format as formatJalali } from "date-fns-jalali";
import { faIR as faIRJalali } from "date-fns-jalali/locale";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  expireStalePendingBookings,
  isCardTransferExpired,
  requireStaff,
  PRICING_SETTINGS_ID,
} from "@/lib/booking.service";
import { sendApprovalSms } from "@/lib/sms.server";
import { toFa } from "@/lib/fa-format";

/** Card-transfer info served to any authenticated user. */
export const getCardTransferInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("pricing_settings")
      .select("card_number, card_holder")
      .eq("id", PRICING_SETTINGS_ID)
      .maybeSingle();
    return {
      cardNumber: data?.card_number ?? "",
      cardHolder: data?.card_holder ?? "",
    };
  });

export const submitReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        bookingId: z.string().uuid(),
        imagePath: z.string().trim().min(1).max(300),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // the user-scoped client can't UPDATE bookings (no own-update policy),
    // so reads + the expiry cancel go through the admin client
    const { data: booking, error } = await supabaseAdmin
      .from("bookings")
      .select("id, user_id, status, payment_status, created_at")
      .eq("id", data.bookingId)
      .maybeSingle();

    if (error || !booking) throw new Error("رزرو پیدا نشد.");
    if (booking.user_id !== context.userId) throw new Error("این رزرو متعلق به شما نیست.");
    if (booking.payment_status === "paid") throw new Error("این رزرو قبلاً پرداخت شده است.");
    if (booking.status === "cancelled") throw new Error("رزرو لغوشده قابل پرداخت نیست.");

    // path must live under the user's own folder
    if (!data.imagePath.startsWith(`${context.userId}/`)) {
      throw new Error("مسیر آپلود رسید نامعتبر است.");
    }

    const { data: existing } = await supabaseAdmin
      .from("payment_receipts")
      .select("status")
      .eq("booking_id", data.bookingId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.status === "pending") {
      throw new Error("رسیدی قبلاً ارسال شده و در انتظار بررسی مدیر است.");
    }

    // first upload must land inside the 10-minute window; a rejected
    // receipt re-opens the window so the user can try again
    const hadRejection = existing?.status === "rejected";
    if (!hadRejection && isCardTransferExpired(booking.created_at)) {
      await supabaseAdmin.from("bookings").update({ status: "cancelled" }).eq("id", booking.id);
      throw new Error("مهلت ۱۰ دقیقه‌ای ارسال رسید به پایان رسیده و رزرو لغو شد.");
    }

    const { data: receipt, error: insertErr } = await supabaseAdmin
      .from("payment_receipts")
      .insert({
        booking_id: booking.id,
        user_id: context.userId,
        image_path: data.imagePath,
        status: "pending",
      })
      .select("id, status")
      .single();
    if (insertErr || !receipt) throw new Error("ثبت رسید ناموفق بود.");
    return { id: receipt.id };
  });

export const listMyReceipts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("payment_receipts")
      .select("id, booking_id, status, image_path, created_at, reviewed_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    return data ?? [];
  });

export const listReceipts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data } = await supabaseAdmin
      .from("payment_receipts")
      .select(
        "id, booking_id, user_id, status, image_path, created_at, reviewed_at, booking:bookings!payment_receipts_booking_id_fkey(id, code, full_name, phone, booking_type, start_at, total_amount, status)",
      )
      .order("created_at", { ascending: false })
      .limit(200);

    const rows = data ?? [];
    const signed = await Promise.all(
      rows.map(async (r) => {
        let signedUrl = "";
        if (r.image_path) {
          const { data: url } = await supabaseAdmin.storage
            .from("receipts")
            .createSignedUrl(r.image_path, 60 * 60);
          signedUrl = url?.signedUrl ?? "";
        }
        return { ...r, signedUrl };
      }),
    );
    return signed;
  });

export const reviewReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        receiptId: z.string().uuid(),
        action: z.enum(["approve", "reject"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: receipt } = await supabaseAdmin
      .from("payment_receipts")
      .select(
        "id, booking_id, status, user_id, booking:bookings!payment_receipts_booking_id_fkey(id, full_name, phone, start_at, status)",
      )
      .eq("id", data.receiptId)
      .maybeSingle();

    if (!receipt) throw new Error("رسید پیدا نشد.");
    if (receipt.status !== "pending") throw new Error("این رسید قبلاً بررسی شده است.");

    const booking = receipt.booking;
    if (!booking) throw new Error("رزرو این رسید پیدا نشد.");
    if (booking.status === "cancelled") throw new Error("رزرو این رسید لغو شده است.");

    await supabaseAdmin
      .from("payment_receipts")
      .update({
        status: data.action,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", receipt.id);

    if (data.action === "approve") {
      await supabaseAdmin
        .from("bookings")
        .update({ payment_status: "paid", status: "confirmed" })
        .eq("id", booking.id);

      const start = new Date(booking.start_at);
      await sendApprovalSms({
        phone: booking.phone,
        username: booking.full_name || "کاربر",
        hour: toFa(formatJalali(start, "H", { locale: faIRJalali })),
        day: toFa(formatJalali(start, "d MMMM yyyy", { locale: faIRJalali })),
      });
    }

    return { ok: true, action: data.action };
  });

export { expireStalePendingBookings };
