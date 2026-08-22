import type { PublicDesk } from "@/lib/booking.functions";
import type { BookingType } from "@/lib/booking.service";

export const DESK_DISPLAY_META: Record<
  PublicDesk["displayStatus"] | "selected",
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
  selected: {
    label: "انتخاب شده",
    dot: "bg-blue-500",
    cell: "border-blue-500/35 bg-blue-500/10 hover:bg-blue-500/15",
  },
};

export type DeskAvailabilityMode = "now" | "window";

export const DESK_LABELS: Record<
  DeskAvailabilityMode,
  Record<PublicDesk["displayStatus"] | "selected", string>
> = {
  now: { free: "آزاد", held: "رزرو موقت", busy: "پر", selected: "انتخاب شده" },
  window: { free: "آزاد در این بازه", held: "رزرو موقت در این بازه", busy: "پر", selected: "انتخاب شده" },
};

export const PLAN_DESK_LABELS: Record<BookingType, Record<PublicDesk["displayStatus"] | "selected", string>> = {
  hourly: { free: "آزاد", held: "رزرو موقت", busy: "پر", selected: "انتخاب شده" },
  daily: { free: "آزاد کل روز", held: "رزرو موقت", busy: "پر", selected: "انتخاب شده" },
  monthly: { free: "آزاد و پایدار", held: "رزرو موقت", busy: "پر", selected: "انتخاب شده" },
};
