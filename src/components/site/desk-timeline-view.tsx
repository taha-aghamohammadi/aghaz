import { cn } from "@/lib/utils";
import { toFa } from "@/lib/fa-format";
import { BUSINESS_HOUR_START, BUSINESS_HOUR_END, type PublicDesk } from "@/lib/booking.service";

const CELLS: number[] = Array.from(
  { length: BUSINESS_HOUR_END - BUSINESS_HOUR_START },
  (_, i) => BUSINESS_HOUR_START + i,
);

type CellState = "occupied" | "reserved" | "free";

function cellClass(state: CellState): string {
  switch (state) {
    case "occupied":
      return "bg-destructive/15 border-destructive/30";
    case "reserved":
      return "bg-warning/20 border-warning/40";
    default:
      return "bg-success/10 border-success/25";
  }
}

export function DeskTimelineView({
  desks,
  selectedId,
  onSelect,
}: {
  desks: PublicDesk[];
  selectedId?: string | null;
  onSelect: (desk: PublicDesk) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        <div className="grid grid-cols-[4.5rem_1fr] items-center gap-2 border-b border-hairline pb-2">
          <span className="text-[11px] font-medium text-muted-foreground">میز</span>
          <div className="grid grid-cols-12 gap-1 text-center text-[10px] text-muted-foreground">
            {CELLS.map((h) => (
              <span key={h} dir="ltr">
                {toFa(h)}
              </span>
            ))}
          </div>
        </div>
        <div className="divide-y divide-hairline">
          {desks.map((desk) => (
            <button
              key={desk.id}
              type="button"
              onClick={() => onSelect(desk)}
              className={cn(
                "grid w-full grid-cols-[4.5rem_1fr] items-center gap-2 py-2 text-right transition hover:bg-surface/60",
                selectedId === desk.id && "rounded-lg bg-surface ring-1 ring-primary/40",
              )}
            >
              <span className="truncate text-[12px]">
                <span className="font-semibold" dir="ltr">
                  {desk.code}
                </span>
                <span className="mt-0.5 block truncate text-[10.5px] text-muted-foreground">
                  {desk.zone}
                </span>
              </span>
              <span className="grid grid-cols-12 gap-1">
                {CELLS.map((h) => (
                  <span
                    key={h}
                    className={cn("h-6 rounded-md border", cellClass(cellStateFor(desk, h)))}
                  />
                ))}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function cellStateFor(desk: PublicDesk, hour: number): CellState {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const slotStart = new Date(start);
  slotStart.setHours(hour, 0, 0, 0);
  const slotEnd = new Date(start);
  slotEnd.setHours(hour + 1, 0, 0, 0);
  const now = Date.now();

  const covering = desk.reservedIntervals.find((iv) =>
    overlaps(slotStart, slotEnd, iv.startAt, iv.endAt),
  );
  if (!covering) return "free";
  // Interval already started → occupied now; starts in future → reserved later today.
  return new Date(covering.startAt).getTime() <= now ? "occupied" : "reserved";
}

function overlaps(aStart: Date, aEnd: Date, bStartStr: string, bEndStr: string): boolean {
  const bStart = new Date(bStartStr);
  const bEnd = new Date(bEndStr);
  return aStart < bEnd && bStart < aEnd;
}
