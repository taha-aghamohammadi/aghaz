import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CalendarIcon, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PersianCalendar } from "@/components/ui/persian-calendar";
import { useBooking, type BookingType } from "@/components/site/BookingDialog";
import { listPublicDesks, type PublicDesk } from "@/lib/booking.functions";
import {
  BUSINESS_HOUR_END,
  BUSINESS_HOUR_START,
  DEFAULT_PRICING,
  iranDateTime,
  tryBuildWindow,
  unitPriceForType,
  type PricingTiers,
} from "@/lib/booking.service";
import { toman, toFa, faJalaliDate } from "@/lib/fa-format";

import {
  AVAILABILITY_MODES,
  DESK_DISPLAY_META,
  DESK_LABELS,
  PLAN_DESK_LABELS,
} from "@/components/site/desk-display-meta";
import { WeekAvailabilityGrid } from "@/components/site/week-availability-grid";
import { FloorPlanView } from "@/components/site/floor-plan-view";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${color}`} /> {label}
    </span>
  );
}

const TIER_LABELS: Record<BookingType, string> = {
  hourly: "ساعتی",
  daily: "روزانه",
  monthly: "ماهانه",
};

const HOURS = Array.from(
  { length: BUSINESS_HOUR_END - BUSINESS_HOUR_START },
  (_, i) => BUSINESS_HOUR_START + i,
);

type WeekDay = { date: Date; dateStr: string; desks: PublicDesk[] };

export function LiveDeskMap() {
  const { open, preferredType, availabilityMode, changeMode } = useBooking();
  const fetchDesks = useServerFn(listPublicDesks);
  const [desks, setDesks] = useState<PublicDesk[]>([]);
  const [pricing, setPricing] = useState<PricingTiers>(DEFAULT_PRICING);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<PublicDesk | null>(null);

  const [windowDate, setWindowDate] = useState<Date | undefined>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  });
  const [windowStartHour, setWindowStartHour] = useState(10);
  const [windowDuration, setWindowDuration] = useState(2);
  const [weekData, setWeekData] = useState<WeekDay[]>([]);
  const [weekLoading, setWeekLoading] = useState(false);

  const [planType, setPlanType] = useState<BookingType>(preferredType ?? "hourly");
  const [view, setView] = useState<"grid" | "plan">("grid");

  useEffect(() => {
    if (preferredType) setPlanType(preferredType);
  }, [preferredType]);

  const bookingWindow = useMemo(() => {
    if (!windowDate) return null;
    return tryBuildWindow({
      bookingType: "hourly",
      dateStr: format(windowDate, "yyyy-MM-dd"),
      startHour: windowStartHour,
      duration: windowDuration,
    });
  }, [windowDate, windowStartHour, windowDuration]);

  const planWindow = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    if (planType === "daily") {
      return {
        windowStart: iranDateTime(today, BUSINESS_HOUR_START),
        windowEnd: iranDateTime(today, BUSINESS_HOUR_END),
      };
    }
    if (planType === "monthly") {
      return {
        windowStart: iranDateTime(today, BUSINESS_HOUR_START),
        windowEnd: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString(),
      };
    }
    return null;
  }, [planType]);

  const loadWindow = useCallback(
    (params: { windowStart?: string; windowEnd?: string }) =>
      fetchDesks({ data: params })
        .then((res) => {
          setDesks(res.desks);
          setPricing(res.pricing);
          setError(false);
        })
        .catch(() => setError(true))
        .finally(() => setLoading(false)),
    [fetchDesks],
  );

  const reload = useCallback(() => {
    if (availabilityMode === "week") return;
    setLoading(true);
    const win = bookingWindow;
    if (availabilityMode === "timeFirst" && win) {
      void loadWindow({ windowStart: win.startAt, windowEnd: win.endAt });
    } else if (planWindow) {
      void loadWindow(planWindow);
    } else {
      void loadWindow({});
    }
  }, [availabilityMode, bookingWindow, planWindow, loadWindow]);

  useEffect(() => {
    if (availabilityMode === "week") return;
    let active = true;
    setLoading(true);
    const win = bookingWindow;
    if (availabilityMode === "timeFirst" && win) {
      const t = setTimeout(
        () =>
          void loadWindow({ windowStart: win.startAt, windowEnd: win.endAt }).then(() => {
            if (!active) return;
          }),
        300,
      );
      return () => {
        active = false;
        clearTimeout(t);
      };
    }
    const params = planWindow ?? {};
    const load = () => void loadWindow(params);
    load();
    const timer = setInterval(load, 60_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [availabilityMode, bookingWindow, planWindow, loadWindow]);

  useEffect(() => {
    if (availabilityMode !== "week") return;
    let active = true;
    setWeekLoading(true);
    const days: { date: Date; dateStr: string }[] = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return { date: d, dateStr: format(d, "yyyy-MM-dd") };
    });
    Promise.all(
      days.map((d) =>
        fetchDesks({
          data: {
            windowStart: iranDateTime(d.dateStr, BUSINESS_HOUR_START),
            windowEnd: iranDateTime(d.dateStr, BUSINESS_HOUR_END),
          },
        }).then((res) => ({ ...d, desks: res.desks })),
      ),
    )
      .then((data) => {
        if (active) setWeekData(data);
      })
      .catch(() => {
        if (active) setWeekData([]);
      })
      .finally(() => {
        if (active) setWeekLoading(false);
      });
    return () => {
      active = false;
    };
  }, [availabilityMode, fetchDesks]);

  const free = desks.filter((d) => d.displayStatus === "free").length;
  const labelsMode =
    availabilityMode === "timeFirst" ? "window" : availabilityMode === "week" ? "week" : "now";
  const labels =
    availabilityMode === "timeFirst" || availabilityMode === "week"
      ? DESK_LABELS[labelsMode]
      : PLAN_DESK_LABELS[planType];

  return (
    <section
      id="desks"
      className="scroll-mt-24 border-b border-hairline bg-surface/40 py-24 md:py-32"
    >
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-10 md:grid-cols-[0.85fr_1.15fr] md:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-hairline bg-background px-3 py-1 text-[11px] text-muted-foreground">
              <span className="inline-flex h-1.5 w-1.5 animate-pulse-dot rounded-full bg-success" />
              ظرفیت لحظه‌ای
            </div>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
              ببین چی خالیه، همین الان.
            </h2>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted-foreground">
              نقشه‌ی میزهای اشتراکی آغاز از داده‌ی واقعی سامانه به‌روز می‌شود. روی هر میز بزن و رزرو
              کن.
            </p>
            {availabilityMode !== "week" && (
              <>
                <div className="mt-6 flex items-baseline gap-2">
                  <span className="text-5xl font-semibold tracking-tight">
                    {error ? "–" : toFa(free)}
                  </span>
                  <span className="text-[13px] text-muted-foreground">
                    {error
                      ? "وضعیت در دسترس نیست"
                      : `میز ${
                          availabilityMode === "timeFirst" ? "آزاد در بازه‌ی انتخابی" : labels.free
                        } از ${toFa(desks.length)} میز`}
                  </span>
                </div>
                <div className="mt-6 flex flex-wrap gap-4 text-[12.5px] text-muted-foreground">
                  <Legend color="bg-success" label={labels.free} />
                  <Legend color="bg-warning" label={labels.held} />
                  <Legend color="bg-destructive" label={labels.busy} />
                </div>
              </>
            )}
            {preferredType && (
              <p className="mt-6 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-[13px] text-foreground">
                پلن {TIER_LABELS[preferredType]} انتخاب شد — یک میز آزاد را انتخاب کنید.
              </p>
            )}
          </div>

          <div className="overflow-hidden rounded-3xl border border-hairline bg-card">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-hairline px-5 py-3">
              <div className="min-w-0 truncate text-[12px] font-medium text-muted-foreground">
                نقشه‌ی سالن · دفتر مرکزی آغاز
              </div>
              <div className="shrink-0 text-[11px] text-muted-foreground">
                {loading ? "در حال به‌روزرسانی…" : "به‌روز"}
              </div>
            </div>

            <div className="border-b border-hairline px-4 py-3">
              <div className="grid grid-cols-4 gap-1.5 rounded-full border border-hairline bg-surface/60 p-1.5">
                {AVAILABILITY_MODES.map((m) => {
                  const active = m.id === availabilityMode;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => changeMode(m.id)}
                      className={cn(
                        "rounded-full px-1 py-2.5 text-[12.5px] transition",
                        active
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-surface",
                      )}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {availabilityMode === "timeFirst" && (
              <div className="flex flex-wrap items-end gap-3 border-b border-hairline bg-surface/30 px-4 py-3">
                <div>
                  <div className="text-[10px] font-medium tracking-widest text-muted-foreground">
                    تاریخ
                  </div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="mt-1 h-11 justify-start rounded-xl border-hairline text-right font-normal text-[12.5px]"
                      >
                        <CalendarIcon className="ml-2 h-3.5 w-3.5" />
                        {windowDate ? faJalaliDate(windowDate) : "انتخاب تاریخ"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <PersianCalendar
                        mode="single"
                        selected={windowDate}
                        onSelect={setWindowDate}
                        disabled={(d) => {
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          return d < today;
                        }}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <div className="text-[10px] font-medium tracking-widest text-muted-foreground">
                    ساعت شروع
                  </div>
                  <select
                    value={windowStartHour}
                    onChange={(e) => setWindowStartHour(Number(e.target.value))}
                    className="mt-1 h-11 rounded-xl border border-hairline bg-card px-2 text-[12.5px]"
                  >
                    {HOURS.map((h) => (
                      <option key={h} value={h}>
                        {toFa(h)}:۰۰
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="text-[10px] font-medium tracking-widest text-muted-foreground">
                    مدت
                  </div>
                  <select
                    value={windowDuration}
                    onChange={(e) => setWindowDuration(Number(e.target.value))}
                    className="mt-1 h-11 rounded-xl border border-hairline bg-card px-2 text-[12.5px]"
                  >
                    {Array.from(
                      { length: Math.min(6, BUSINESS_HOUR_END - windowStartHour) },
                      (_, i) => i + 1,
                    ).map((h) => (
                      <option key={h} value={h}>
                        {toFa(h)} ساعت
                      </option>
                    ))}
                  </select>
                </div>
                {bookingWindow && (
                  <div className="mb-0.5 inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface/60 px-2.5 py-1 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span dir="ltr">
                      {toFa(windowStartHour)}:۰۰ – {toFa(windowStartHour + windowDuration)}:۰۰
                    </span>
                  </div>
                )}
              </div>
            )}

            {(availabilityMode === "now" || availabilityMode === "deskFirst") && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline bg-surface/30 px-4 py-3">
                <div className="flex rounded-full border border-hairline bg-background p-1">
                  {(Object.keys(TIER_LABELS) as BookingType[]).map((t) => {
                    const active = t === planType;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setPlanType(t)}
                        className={cn(
                          "rounded-full px-3 py-2 text-[12.5px] transition",
                          active
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:bg-surface",
                        )}
                      >
                        {TIER_LABELS[t]}
                      </button>
                    );
                  })}
                </div>
                <div className="flex rounded-full border border-hairline bg-background p-1">
                  {(
                    [
                      { id: "grid", label: "شبکه‌ای" },
                      { id: "plan", label: "پلان سالن" },
                    ] as const
                  ).map((v) => {
                    const active = v.id === view;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setView(v.id)}
                        className={cn(
                          "rounded-full px-3 py-2 text-[12.5px] transition",
                          active
                            ? "bg-foreground/10 text-foreground"
                            : "text-muted-foreground hover:bg-surface",
                        )}
                      >
                        {v.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="bg-[radial-gradient(circle_at_1px_1px,color-mix(in_oklab,var(--foreground)_10%,transparent)_1px,transparent_0)] [background-size:22px_22px] p-4 sm:p-6">
              {availabilityMode === "week" ? (
                <WeekAvailabilityGrid
                  weekData={weekData}
                  weekLoading={weekLoading}
                  onSelect={(desk, date) => {
                    setSelected(null);
                    open({ type: preferredType ?? "hourly", desk, date });
                  }}
                />
              ) : error ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <p className="text-[13px] text-muted-foreground">خطا در دریافت وضعیت میزها</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={reload}
                    className="h-10 rounded-full px-4"
                  >
                    دوباره تلاش کن
                  </Button>
                </div>
              ) : loading ? (
                <p className="py-8 text-center text-[13px] text-muted-foreground">بارگذاری نقشه…</p>
              ) : view === "plan" ? (
                <FloorPlanView
                  desks={desks}
                  labels={labels}
                  selectedId={selected?.id}
                  onSelect={setSelected}
                />
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {desks.map((d) => {
                    const deskMeta = DESK_DISPLAY_META[d.displayStatus];
                    const isFree = d.displayStatus === "free";
                    const isSelected = selected?.id === d.id;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setSelected(d)}
                        className={`group cursor-pointer rounded-2xl border p-3 text-right transition ${deskMeta.cell} ${
                          isFree ? "" : "opacity-80"
                        } ${isSelected ? "ring-2 ring-primary ring-offset-1 ring-offset-card" : ""}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13.5px] font-semibold">{d.name}</span>
                          <span className={`h-2 w-2 shrink-0 rounded-full ${deskMeta.dot}`} />
                        </div>
                        <div className="mt-1 truncate text-[11px] text-muted-foreground">
                          {d.zone}
                        </div>
                        <div className="mt-3 text-[11px] text-foreground/70">
                          {labels[d.displayStatus]}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {selected && availabilityMode !== "week" && (
              <div className="sticky bottom-0 z-10 flex items-center justify-between gap-4 border-t border-hairline bg-card px-5 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface text-[12px] font-semibold">
                    {selected.code}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-semibold">
                      {selected.name} · {selected.zone}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${DESK_DISPLAY_META[selected.displayStatus].dot}`}
                      />
                      {labels[selected.displayStatus]} ·{" "}
                      {toman(unitPriceForType(pricing, planType))}
                    </div>
                  </div>
                </div>
                <Button
                  className="shrink-0 rounded-full px-6"
                  disabled={selected.displayStatus !== "free"}
                  onClick={() => {
                    setSelected(null);
                    open({ type: planType, desk: selected });
                  }}
                >
                  {selected.displayStatus === "free" ? "رزرو این میز" : "در دسترس نیست"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
