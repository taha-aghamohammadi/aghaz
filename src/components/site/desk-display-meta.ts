import type { PublicDesk } from "@/lib/booking.functions";

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

export type DeskAvailabilityMode = "now" | "window" | "week";

export const DESK_LABELS: Record<
  DeskAvailabilityMode,
  Record<PublicDesk["displayStatus"], string>
> = {
  now: { free: "آزاد", held: "رزرو شده", busy: "پر" },
  window: { free: "آزاد در این بازه", held: "رزرو در این بازه", busy: "پر" },
  week: { free: "آزاد", held: "رزرو", busy: "پر" },
};

export type AvailabilityMode = "now" | "deskFirst" | "timeFirst" | "week";

export const AVAILABILITY_MODES: { id: AvailabilityMode; label: string; hint: string }[] = [
  { id: "now", label: "لحظه‌ای", hint: "وضعیت همین حالا" },
  { id: "deskFirst", label: "اول میز", hint: "میز بعد از زمان" },
  { id: "timeFirst", label: "اول زمان", hint: "زمان بعد از میز" },
  { id: "week", label: "هفته", hint: "نمای ۷ روزه" },
];

export const AVAILABILITY_MODE_KEY = "aghaz_availability_mode";
