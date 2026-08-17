import { format as formatJalali } from "date-fns-jalali";
import { faIR as faIRJalali } from "date-fns-jalali/locale";
import { toEnDigits } from "@/lib/national-id";

export const toFa = (n: number | string) => String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]!);

export function stripPriceDigits(raw: string): string {
  return toEnDigits(raw).replace(/\D/g, "");
}

/** Digits-only string → comma-separated display (e.g. 590000 → "590,000"). */
export function formatPriceWithCommas(value: string | number): string {
  const digits =
    typeof value === "number" ? String(Math.max(0, Math.floor(value))) : stripPriceDigits(value);
  if (!digits) return "";
  return Number(digits).toLocaleString("en-US");
}

export function parsePriceAmount(raw: string): number | null {
  const digits = stripPriceDigits(raw);
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

export function faNumber(v: number) {
  return toFa(v.toLocaleString("en-US"));
}

/** 16-digit card → "1234-5678-9012-3456"; no-op otherwise. Display only. */
export function formatCardNumber(card: string): string {
  const digits = toEnDigits(card);
  if (digits.length !== 16) return card;
  return digits.replace(/(\d{4})(?=\d)/g, "$1-");
}

export const MAX_RECEIPT_FILE_SIZE = 5 * 1024 * 1024;

/** Returns an error message when the file is rejected, else null. */
export function validateReceiptFile(file: File): string | null {
  if (!file.type.startsWith("image/")) return "فقط تصویر قابل آپلود است.";
  if (file.size > MAX_RECEIPT_FILE_SIZE) return "حجم تصویر نباید بیشتر از ۵ مگابایت باشد.";
  return null;
}

export function toman(v: number) {
  return `${faNumber(v)} تومان`;
}

export function tomanShort(v: number) {
  if (v >= 1_000_000) {
    const m = v / 1_000_000;
    return `${toFa(m.toFixed(m % 1 === 0 ? 0 : 1).replace(".", "٫"))}م تومان`;
  }
  if (v >= 1_000) return `${toFa(Math.round(v / 1_000))}هزار تومان`;
  return `${faNumber(v)} تومان`;
}

export function pricingMainAmount(rate: number): string {
  if (rate >= 1_000_000) {
    const m = rate / 1_000_000;
    return toFa(m.toFixed(m % 1_000_000 === 0 ? 0 : 1).replace(".", "٫"));
  }
  return toFa(Math.round(rate / 1_000));
}

export function pricingUnitLabel(rate: number, period: "hour" | "day" | "month"): string {
  const periodLabel = period === "hour" ? "ساعت" : period === "day" ? "روز" : "ماه";
  if (rate >= 1_000_000) return `میلیون تومان / ${periodLabel}`;
  return `هزار تومان / ${periodLabel}`;
}

const FA_DATE = new Intl.DateTimeFormat("fa-IR", {
  year: "numeric",
  month: "long",
  day: "numeric",
});
const FA_DATETIME = new Intl.DateTimeFormat("fa-IR", {
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function faDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  return FA_DATE.format(new Date(value));
}

export function faDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  return FA_DATETIME.format(new Date(value));
}

/** Jalali (Shamsi) long date label for booking UI. */
export function faJalaliDate(value: Date | null | undefined) {
  if (!value) return "—";
  return formatJalali(value, "EEEE d MMMM yyyy", { locale: faIRJalali });
}

/** Jalali date + time for receipts. */
export function faJalaliDateTime(value: Date | null | undefined) {
  if (!value) return "—";
  return formatJalali(value, "d MMMM yyyy · HH:mm", { locale: faIRJalali });
}

export const BOOKING_TYPE_LABEL: Record<string, string> = {
  hourly: "ساعتی",
  daily: "روزانه",
  monthly: "ماهانه",
};

export const BOOKING_STATUS_LABEL: Record<string, string> = {
  pending: "در انتظار",
  confirmed: "تأییدشده",
  cancelled: "لغوشده",
  done: "پایان‌یافته",
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  unpaid: "پرداخت‌نشده",
  paid: "پرداخت‌شده",
  refunded: "بازگشت‌داده",
};

export const DESK_STATUS_LABEL: Record<string, string> = {
  free: "آزاد",
  busy: "در استفاده",
  reserved: "رزروشده",
  maintenance: "تعمیر",
};

export const ROLE_LABEL: Record<string, string> = {
  admin: "مدیر",
  staff: "کارمند",
  user: "کاربر",
};
