import { useMemo } from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { faJalaliDate } from "@/lib/fa-format";
import { DESK_DISPLAY_META, DESK_LABELS } from "@/components/site/desk-display-meta";
import type { PublicDesk } from "@/lib/booking.functions";

export function WeekAvailabilityGrid({
  weekData,
  weekLoading,
  onSelect,
}: {
  weekData: { date: Date; dateStr: string; desks: PublicDesk[] }[];
  weekLoading: boolean;
  onSelect: (desk: PublicDesk, date: Date) => void;
}) {
  const weekDesks = useMemo(() => {
    const map = new Map<string, PublicDesk>();
    weekData.forEach((d) => d.desks.forEach((desk) => map.set(desk.id, desk)));
    return Array.from(map.values());
  }, [weekData]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-medium tracking-widest text-muted-foreground">
          میز در هفته‌ی پیش رو
        </div>
        {weekLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
      {weekLoading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          بارگذاری هفته…
        </div>
      ) : weekData.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-muted-foreground">
          میز فعالی در سامانه ثبت نشده است.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <div className="grid min-w-[560px] grid-cols-[1.1fr_repeat(7,1fr)] gap-1.5">
            <div />
            {weekData.map((d) => (
              <div key={d.dateStr} className="text-center">
                <div className="text-[12px] font-medium">
                  {new Intl.DateTimeFormat("fa-IR", { weekday: "short" }).format(d.date)}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {faJalaliDate(d.date).split(" ").slice(0, -1).join(" ")}
                </div>
              </div>
            ))}
            {weekDesks.map((desk) => (
              <div key={desk.id} className="contents">
                <div className="flex min-h-0 flex-col justify-center gap-0.5 py-1">
                  <span className="truncate text-[12px] font-semibold">{desk.name}</span>
                  <span className="text-[10px] text-muted-foreground">{desk.code}</span>
                </div>
                {weekData.map((d) => {
                  const dayDesk = d.desks.find((dd) => dd.id === desk.id);
                  const status = dayDesk?.displayStatus ?? "busy";
                  const meta = DESK_DISPLAY_META[status];
                  const free = status === "free";
                  return (
                    <button
                      key={d.dateStr}
                      type="button"
                      disabled={!free}
                      onClick={() => onSelect(desk, d.date)}
                      className={cn(
                        "grid min-h-9 place-items-center rounded-lg border text-[11px] transition",
                        meta.cell,
                        free
                          ? "cursor-pointer hover:ring-1 hover:ring-primary"
                          : "cursor-not-allowed opacity-70",
                      )}
                    >
                      {free ? (
                        <Check className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <span className="text-[10px] text-muted-foreground">
                          {DESK_LABELS.week[status]}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
