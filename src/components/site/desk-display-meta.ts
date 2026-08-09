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
