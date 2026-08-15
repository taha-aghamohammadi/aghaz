import { addDays, addHours, addMonths, format } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type BookingType = "hourly" | "daily" | "monthly";
export type DeskDisplayStatus = "free" | "held" | "busy";

export const PRICING_SETTINGS_ID = "00000000-0000-0000-0000-000000000001";

export type PricingTiers = {
  hourlyRate: number;
  dailyRate: number;
  monthlyRate: number;
  discountPercent: number;
  discountEndsAt: string | null;
};

type PricingRow = Database["public"]["Tables"]["pricing_settings"]["Row"];
export type { PricingRow };

export const BUSINESS_HOUR_START = 8;
export const BUSINESS_HOUR_END = 20;

/** Card-transfer receipts must be uploaded within 10 minutes of booking creation. */
export const CARD_PAYMENT_WINDOW_MS = 10 * 60 * 1000;

export function isCardTransferExpired(createdAt: string, now = new Date()): boolean {
  return now.getTime() - new Date(createdAt).getTime() > CARD_PAYMENT_WINDOW_MS;
}

type DeskRow = Database["public"]["Tables"]["desks"]["Row"];
type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];

export type PublicDesk = {
  id: string;
  code: string;
  name: string;
  zone: string;
  features: string[];
  locationNote: string;
  adminStatus: string;
  displayStatus: DeskDisplayStatus;
  isActive: boolean;
};

export function generateBookingCode(): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const s =
    letters[Math.floor(Math.random() * letters.length)] +
    letters[Math.floor(Math.random() * letters.length)];
  return `AGZ-${s}${n}`;
}

/** Iran (+03:30) local slot as ISO string. */
export function iranDateTime(dateStr: string, hour: number, minute = 0): string {
  const h = String(hour).padStart(2, "0");
  const m = String(minute).padStart(2, "0");
  return `${dateStr}T${h}:${m}:00+03:30`;
}

export function parseDateOnly(dateStr: string): Date {
  const [y, mo, d] = dateStr.split("-").map(Number);
  return new Date(y, mo - 1, d);
}

export function computeBookingWindow(input: {
  bookingType: BookingType;
  dateStr: string;
  startHour?: number;
  duration?: number;
  months?: number;
}): { startAt: string; endAt: string; units: number } {
  const { bookingType, dateStr } = input;

  if (bookingType === "hourly") {
    const startHour = input.startHour ?? BUSINESS_HOUR_START;
    const duration = input.duration ?? 1;
    if (startHour < BUSINESS_HOUR_START || startHour + duration > BUSINESS_HOUR_END) {
      throw new Error("بازه ساعتی باید بین ۸ تا ۲۰ باشد.");
    }
    const startAt = iranDateTime(dateStr, startHour);
    const endAt = addHours(new Date(startAt), duration).toISOString();
    return { startAt, endAt, units: duration };
  }

  if (bookingType === "daily") {
    const duration = input.duration ?? 1;
    const startAt = iranDateTime(dateStr, BUSINESS_HOUR_START);
    const lastDay = format(addDays(parseDateOnly(dateStr), duration - 1), "yyyy-MM-dd");
    const endAt = iranDateTime(lastDay, BUSINESS_HOUR_END);
    return { startAt, endAt, units: duration };
  }

  const months = input.months ?? 1;
  const startAt = iranDateTime(dateStr, BUSINESS_HOUR_START);
  const endAt = addMonths(new Date(startAt), months).toISOString();
  return { startAt, endAt, units: months };
}

export function mapPricingRow(row: PricingRow): PricingTiers {
  return {
    hourlyRate: row.hourly_rate,
    dailyRate: row.daily_rate,
    monthlyRate: row.monthly_rate,
    discountPercent: row.discount_percent ?? 0,
    discountEndsAt: row.discount_ends_at,
  };
}

export const DEFAULT_PRICING: PricingTiers = {
  hourlyRate: 90000,
  dailyRate: 590000,
  monthlyRate: 7900000,
  discountPercent: 0,
  discountEndsAt: null,
};

export function isDiscountActive(pricing: PricingTiers): boolean {
  if (pricing.discountPercent <= 0) return false;
  if (!pricing.discountEndsAt) return false;
  return new Date(pricing.discountEndsAt) > new Date();
}

export function applyDiscount(base: number, discountPercent: number): number {
  if (discountPercent <= 0) return base;
  return Math.max(0, Math.round(base * (1 - discountPercent / 100)));
}

export async function fetchPricingSettings(
  client: SupabaseClient<Database>,
): Promise<PricingTiers> {
  const { data, error } = await client
    .from("pricing_settings")
    .select("*")
    .eq("id", PRICING_SETTINGS_ID)
    .maybeSingle();

  if (error || !data) return DEFAULT_PRICING;
  return mapPricingRow(data as PricingRow);
}

export function unitPriceForType(pricing: PricingTiers, bookingType: BookingType): number {
  const base =
    bookingType === "hourly"
      ? pricing.hourlyRate
      : bookingType === "daily"
        ? pricing.dailyRate
        : pricing.monthlyRate;
  if (!isDiscountActive(pricing)) return base;
  return applyDiscount(base, pricing.discountPercent);
}

export function unitPriceForDesk(desk: DeskRow, bookingType: BookingType): number {
  if (bookingType === "hourly") return desk.hourly_rate;
  if (bookingType === "daily") return desk.daily_rate;
  return desk.monthly_rate;
}

export function computeTotalAmount(unitPrice: number, units: number): number {
  return unitPrice * units;
}

export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);
}

export async function findOverlappingBookings(
  client: SupabaseClient<Database>,
  deskId: string,
  startAt: string,
  endAt: string,
): Promise<BookingRow[]> {
  const { data, error } = await client
    .from("bookings")
    .select("*")
    .eq("desk_id", deskId)
    .neq("status", "cancelled")
    .lt("start_at", endAt)
    .gt("end_at", startAt);

  if (error) throw new Error("بررسی ظرفیت میز ناموفق بود.");
  return data ?? [];
}

export async function isDeskAvailable(
  client: SupabaseClient<Database>,
  deskId: string,
  startAt: string,
  endAt: string,
): Promise<boolean> {
  const overlaps = await findOverlappingBookings(client, deskId, startAt, endAt);
  return overlaps.length === 0;
}

export function bookingDisplayStatus(
  booking: Pick<BookingRow, "status" | "payment_status">,
  windowStart: string,
  windowEnd: string,
  bookingStart: string,
  bookingEnd: string,
): DeskDisplayStatus | null {
  if (!overlaps(windowStart, windowEnd, bookingStart, bookingEnd)) return null;
  if (booking.status === "cancelled") return null;
  if (booking.status === "pending" || booking.payment_status === "unpaid") return "held";
  return "busy";
}

export function computeDeskDisplayStatus(
  desk: DeskRow,
  bookings: BookingRow[],
  windowStart: string,
  windowEnd: string,
): DeskDisplayStatus {
  if (!desk.is_active || desk.status === "maintenance") return "busy";

  let status: DeskDisplayStatus = "free";
  for (const b of bookings) {
    if (b.desk_id !== desk.id) continue;
    const s = bookingDisplayStatus(b, windowStart, windowEnd, b.start_at, b.end_at);
    if (s === "busy") return "busy";
    if (s === "held") status = "held";
  }
  return status;
}

export function mapPublicDesk(
  desk: DeskRow,
  bookings: BookingRow[],
  windowStart: string,
  windowEnd: string,
): PublicDesk {
  return {
    id: desk.id,
    code: desk.code,
    name: desk.name,
    zone: desk.zone,
    features: desk.features ?? [],
    locationNote: desk.location_note,
    adminStatus: desk.status,
    displayStatus: computeDeskDisplayStatus(desk, bookings, windowStart, windowEnd),
    isActive: desk.is_active,
  };
}

export async function requireStaff(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<void> {
  const { data, error } = await client.rpc("is_staff", { _user_id: userId });
  if (error || !data) throw new Error("دسترسی مدیر لازم است.");
}

type ExpireCandidate = {
  id: string;
  status: string;
  payment_status: string;
  created_at: string;
};

/**
 * Lazy 10-minute window for card-transfer payments: any pending+unpaid
 * booking past the window WITHOUT a payment receipt is auto-cancelled.
 * Returns the ids of bookings that were cancelled so callers can adjust
 * their already-fetched rows. Uses the service-role client (users can't
 * UPDATE bookings via RLS). No cron/worker by design.
 */
export async function expireStalePendingBookings(
  selected: ExpireCandidate[] | ExpireCandidate | null,
): Promise<Set<string>> {
  if (!selected) return new Set();
  const rows = Array.isArray(selected) ? selected : [selected];
  const candidates = rows.filter(
    (r) =>
      r.status === "pending" && r.payment_status !== "paid" && isCardTransferExpired(r.created_at),
  );
  if (candidates.length === 0) return new Set();

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const ids = candidates.map((c) => c.id);

  const { data: receipts } = await supabaseAdmin
    .from("payment_receipts")
    .select("booking_id")
    .in("booking_id", ids);

  const withReceipt = new Set((receipts ?? []).map((r) => r.booking_id));
  const toCancel = ids.filter((id) => !withReceipt.has(id));
  if (toCancel.length === 0) return new Set();

  await supabaseAdmin.from("bookings").update({ status: "cancelled" }).in("id", toCancel);
  return new Set(toCancel);
}
