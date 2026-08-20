import type { PublicDesk } from "@/lib/booking.functions";
import type { BookingType } from "@/lib/booking.service";

export const DESK_DISPLAY_META: Record<
  PublicDesk["displayStatus"],
  { label: string; dot: string; cell: string }
> = {
  free: {
    label: "آزاد",
    dot: "bg-success",
    cell: "border-success/35 bg-success/10 hover:bg-success/15",
  },
  held: {
    label: "رزرو شده",
    dot: "bg-warning",
    cell: "border-warning/35 bg-warning/10 hover:bg-warning/15",
  },
  busy: {
    label: "پر",
    dot: "bg-destructive",
    cell: "border-destructive/30 bg-destructive/10 hover:bg-destructive/15",
  },
};

export type DeskAvailabilityMode = "now" | "window";

export const DESK_LABELS: Record<
  DeskAvailabilityMode,
  Record<PublicDesk["displayStatus"], string>
> = {
  now: { free: "آزاد", held: "رزرو شده", busy: "پر" },
  window: { free: "آزاد در این بازه", held: "رزرو در این بازه", busy: "پر" },
};

export const PLAN_DESK_LABELS: Record<BookingType, Record<PublicDesk["displayStatus"], string>> = {
  hourly: { free: "آزاد", held: "رزرو شده", busy: "پر" },
  daily: { free: "آزاد کل روز", held: "رزرو شده", busy: "پر" },
  monthly: { free: "آزاد و پایدار", held: "رزرو شده", busy: "پر" },
};
