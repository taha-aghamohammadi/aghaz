import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CalendarIcon, ChevronLeft, ChevronRight, Clock } from "lucide-react";
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
  overlaps,
  unitPriceForType,
  type PricingTiers,
} from "@/lib/booking.service";
import { toman, toFa, faJalaliDate } from "@/lib/fa-format";

import { DESK_DISPLAY_META, DESK_LABELS } from "@/components/site/desk-display-meta";
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

export function LiveDeskMap() {
  const { open, preferredType } = useBooking();
  const fetchDesks = useServerFn(listPublicDesks);
  const [desks, setDesks] = useState<PublicDesk[]>([]);
  const [pricing, setPricing] = useState<PricingTiers>(DEFAULT_PRICING);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<PublicDesk | null>(null);
  const [glanceDate, setGlanceDate] = useState<Date | null>(null);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);

  const glanceWindow = useMemo(() => {
    if (!glanceDate) return null;
    const ds = format(glanceDate, "yyyy-MM-dd");
    return {
      windowStart: iranDateTime(ds, BUSINESS_HOUR_START),
      windowEnd: iranDateTime(ds, BUSINESS_HOUR_END),
    };
  }, [glanceDate]);

  const timelineDate = useMemo(() => glanceDate ?? new Date(), [glanceDate]);
  const timelineDateStr = useMemo(() => format(timelineDate, "yyyy-MM-dd"), [timelineDate]);

  const hourlyFreeCounts = useMemo(() => {
    if (loading || error || desks.length === 0) return null;
    return Array.from({ length: BUSINESS_HOUR_END - BUSINESS_HOUR_START }, (_, i) => {
      const h = BUSINESS_HOUR_START + i;
      const hs = iranDateTime(timelineDateStr, h);
      const he = iranDateTime(timelineDateStr, h + 1);
      let free = 0;
      for (const d of desks) {
        const isMaintenance = d.displayStatus === "busy" && d.reservedIntervals.length === 0;
        if (isMaintenance) continue;
        const busy = d.reservedIntervals.some((iv) => overlaps(hs, he, iv.startAt, iv.endAt));
        if (!busy) free += 1;
      }
      return { hour: h, free, total: desks.length };
    });
  }, [desks, loading, error, timelineDateStr]);

  const isTodayTimeline = useMemo(() => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    return timelineDateStr === todayStr;
  }, [timelineDateStr]);

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
    setLoading(true);
    void loadWindow(glanceWindow ?? {});
  }, [loadWindow, glanceWindow]);

  useEffect(() => {
    setLoading(true);
    const params = glanceWindow ?? {};
    const load = () => void loadWindow(params);
    load();
    const timer = setInterval(load, 120_000);
    return () => {
      clearInterval(timer);
    };
  }, [loadWindow, glanceWindow]);

  const free = desks.filter((d) => d.displayStatus !== "busy").length;
  // ponytail: LiveDesk is now live-only; plan-specific labels live in dialog
  const labels = DESK_LABELS.window;
  const nowIso = new Date().toISOString();

  const nextReservationAt = (d: PublicDesk): string | null => {
    const future = d.reservedIntervals
      .filter((iv) => iv.startAt > nowIso)
      .map((iv) => iv.startAt)
      .sort();
    return future.length ? future[0] : null;
  };

  return (
    <section
      id="desks"
      className="scroll-mt-24 scroll-pb-24 border-b border-hairline bg-surface/40 py-24 md:py-32"
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
            <div
              className="mt-6 flex items-baseline gap-2"
              role="status"
              aria-live="polite"
              aria-atomic
              aria-busy={loading}
            >
              <span className="text-5xl font-semibold tracking-tight">
                {loading ? (
                  <span className="inline-block h-9 w-12 animate-pulse rounded bg-muted" />
                ) : error ? (
                  "–"
                ) : (
                  toFa(free)
                )}
              </span>
              <span className="text-[13px] text-muted-foreground">
                {loading ? (
                  "در حال بارگذاری…"
                ) : error ? (
                  "وضعیت در دسترس نیست"
                ) : glanceDate ? (
                  `میز ${labels.free} در ${faJalaliDate(glanceDate)}`
                ) : (
                  `میز ${labels.free} از ${toFa(desks.length)} میز`
                )}
              </span>
            </div>
            <div className="mt-6 flex flex-wrap gap-4 text-[12.5px] text-muted-foreground">
              <Legend color="bg-success" label={labels.free} />
              <Legend color="bg-warning" label="رزرو موقت" />
              <Legend color="bg-destructive" label={labels.busy} />
            </div>
            {preferredType && (
              <p className="mt-6 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-[13px] text-foreground">
                پلن {TIER_LABELS[preferredType]} انتخاب شد — یک میز آزاد را انتخاب کنید.
              </p>
            )}
          </div>

          <div className="overflow-hidden rounded-3xl border border-hairline bg-card">
            <div className="grid grid-cols-[1fr_auto] items-center gap-2 border-b border-hairline bg-card px-4 py-3 sm:grid-cols-[1fr_auto_1fr] sm:px-5">
              <div className="min-w-0 truncate text-[12px] font-medium text-muted-foreground">
                نقشه‌ی سالن · دفتر مرکزی آغاز
              </div>
              {/* picker: true center on desktop via grid 1fr_auto_1fr, row2 centered on mobile */}
              <div className="col-span-2 flex items-center justify-center gap-1.5 sm:col-span-1 sm:col-start-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="relative h-8 w-8 rounded-full border-hairline after:absolute after:-inset-2 after:content-['']"
                  aria-label="روز قبل"
                  onClick={() => {
                    const d = new Date(timelineDate);
                    d.setDate(d.getDate() - 1);
                    const today = new Date(); today.setHours(0,0,0,0);
                    if (d < today) return;
                    setGlanceDate(d); setSelectedHour(null);
                  }}
                  disabled={isTodayTimeline && !glanceDate}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="relative inline-flex h-8 items-center gap-1.5 rounded-full border border-hairline bg-surface px-3 text-[12px] font-medium transition hover:bg-surface/80 after:absolute after:-inset-2 after:content-['']"
                      aria-label="انتخاب روز"
                    >
                      <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                      {faJalaliDate(timelineDate)}
                      {isTodayTimeline && !glanceDate && <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] leading-none text-primary-foreground">امروز</span>}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <PersianCalendar
                      mode="single"
                      selected={timelineDate}
                      onSelect={(d) => { if (d) { setGlanceDate(d); setSelectedHour(null); } }}
                      disabled={(d) => { const today=new Date(); today.setHours(0,0,0,0); return d < today; }}
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                <Button
                  variant="outline"
                  size="icon"
                  className="relative h-8 w-8 rounded-full border-hairline after:absolute after:-inset-2 after:content-['']"
                  aria-label="روز بعد"
                  onClick={() => {
                    const d = new Date(timelineDate);
                    d.setDate(d.getDate() + 1);
                    setGlanceDate(d); setSelectedHour(null);
                  }}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
              </div>
              {/* distinct indicator: hollow ring — not solid like desk dots */}
              <div className="col-start-2 flex justify-end sm:col-start-3">
                <span
                  className={`h-2.5 w-2.5 rounded-full border-2 ring-2 ${loading ? "border-muted-foreground/30 bg-muted-foreground/10 ring-muted-foreground/10 animate-pulse" : "border-success bg-success/12 ring-success/20 animate-pulse-dot"}`}
                  role="status"
                  aria-label={loading ? "در حال به‌روزرسانی" : "اتصال زنده — به‌روز"}
                  title={loading ? "در حال به‌روزرسانی…" : "اتصال زنده — به‌روز"}
                />
              </div>
            </div>

            {/* A — daily timeline 8-20 — day picker moved to header (plan A), this strip now only hour cells + actions */}
            <div className="border-b border-hairline bg-card px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-full px-3 text-[12px] text-muted-foreground"
                  onClick={() => open({ type: "daily", date: timelineDate })}
                >
                  رزرو روز کامل
                </Button>
                {selectedHour !== null && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-full px-3 text-[12px]"
                    onClick={() => setSelectedHour(null)}
                  >
                    پاک کردن ساعت
                  </Button>
                )}
              </div>

              {/* hour cells — spacious 88px, horizontal scroll on mobile, grid on desktop */}
              <div
                className="mt-4 flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory sm:grid sm:grid-cols-4 sm:overflow-visible lg:grid-cols-6"
                role="grid"
                aria-label="تایم‌لاین روزانه ۸ تا ۲۰"
              >
                {loading ? (
                  Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="h-[88px] min-w-[88px] flex-1 snap-start animate-pulse rounded-2xl border border-hairline bg-muted/40 sm:min-w-0" />
                  ))
                ) : hourlyFreeCounts ? (
                  hourlyFreeCounts.map(({ hour, free, total }) => {
                    const isSelected = selectedHour === hour;
                    const isPastToday = isTodayTimeline && !glanceDate && hour <= new Date().getHours();
                    const pct = total ? Math.round((free / total) * 100) : 0;
                    const tone = free === 0 ? "border-destructive/30 bg-destructive/5 text-destructive" : free <= 3 ? "border-warning/30 bg-warning/5" : "border-success/20 bg-success/5";
                    return (
                      <button
                        key={hour}
                        type="button"
                        role="gridcell"
                        aria-pressed={isSelected}
                        aria-label={`${toFa(hour)}:۰۰ — ${toFa(free)} میز آزاد از ${toFa(total)}`}
                        disabled={isPastToday}
                        onClick={() => {
                          if (isPastToday) return;
                          const next = isSelected ? null : hour;
                          setSelectedHour(next);
                        }}
                        className={`relative flex min-h-[88px] min-w-[96px] flex-1 snap-start flex-col justify-between rounded-2xl border p-3 text-right transition sm:min-w-0 ${tone} ${isSelected ? "ring-2 ring-primary ring-offset-1 ring-offset-card" : "hover:shadow-sm"} ${isPastToday ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] font-semibold" dir="ltr">{toFa(hour)}:۰۰</span>
                          <span className={`h-2 w-2 rounded-full ${free === 0 ? "bg-destructive" : free <= 3 ? "bg-warning" : "bg-success"}`} />
                        </div>
                        <div className="mt-2">
                          <div className="text-[15px] font-semibold leading-none">{toFa(free)}<span className="text-[11px] font-normal text-muted-foreground"> / {toFa(total)} آزاد</span></div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background/60">
                            <div className="h-full rounded-full bg-current opacity-60" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        {isSelected && <span className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-primary/20" />}
                      </button>
                    );
                  })
                ) : null}
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                هر خانه یک ساعت است (۸ تا ۲۰). روی ساعت بزن تا میزهای همان ساعت فیلتر شوند. «رزرو روز کامل» کل روز را روزانه رزرو می‌کند.
              </p>
            </div>

            <div className="bg-[radial-gradient(circle_at_1px_1px,color-mix(in_oklab,var(--foreground)_10%,transparent)_1px,transparent_0)] [background-size:22px_22px] p-4 sm:p-6">
              {error ? (
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
              ) : (
                <div
                  className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
                  role="list"
                  aria-label="لیست میزها"
                >
                  {desks.map((d) => {
                    const isMaintenance = d.displayStatus === "busy" && d.reservedIntervals.length === 0;
                    const isFreeAtHour = selectedHour !== null
                      ? (() => {
                          if (isMaintenance) return false;
                          const hs = iranDateTime(timelineDateStr, selectedHour);
                          const he = iranDateTime(timelineDateStr, selectedHour + 1);
                          return !d.reservedIntervals.some((iv) => overlaps(hs, he, iv.startAt, iv.endAt));
                        })()
                      : null;
                    const effectiveFree = isFreeAtHour !== null ? isFreeAtHour : d.displayStatus === "free";
                    const effectiveStatus = isFreeAtHour !== null ? (isFreeAtHour ? "free" : "busy") : d.displayStatus;
                    const deskMeta = DESK_DISPLAY_META[effectiveStatus as keyof typeof DESK_DISPLAY_META];
                    const isSelected = selected?.id === d.id;
                    const nextAt = d.displayStatus === "free" ? nextReservationAt(d) : null;
                    const heldUntil = d.displayStatus === "held" ? d.reservedIntervals[0]?.endAt : null;
                    const hourLabel = isFreeAtHour !== null ? (isFreeAtHour ? "آزاد در این ساعت" : "پر در این ساعت") : null;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        aria-label={`${d.name} ${d.zone} ${hourLabel ?? (d.displayStatus === "held" ? "رزرو موقت" : labels[d.displayStatus])}${heldUntil ? ` تا ${new Date(heldUntil).getHours()}:۰۰` : ""}`}
                        aria-pressed={isSelected}
                        onClick={() => setSelected(d)}
                        className={`group cursor-pointer rounded-2xl border p-3 text-right transition ${deskMeta.cell} ${
                          d.displayStatus === "held" ? "border-dashed" : ""
                        } ${effectiveFree ? "" : "opacity-90"} ${isSelected ? "ring-2 ring-primary ring-offset-1 ring-offset-card" : ""} ${isFreeAtHour === false ? "opacity-60" : ""}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13.5px] font-semibold">{d.name}</span>
                          <span className={`h-2 w-2 shrink-0 rounded-full ${deskMeta.dot}`} />
                        </div>
                        <div className="mt-1 truncate text-[11px] text-muted-foreground">
                          {d.zone}
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-foreground/70">
                          <span>{hourLabel ?? (d.displayStatus === "held" ? "رزرو موقت" : labels[d.displayStatus])}</span>
                          {d.displayStatus === "held" && heldUntil && isFreeAtHour === null && (
                            <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10.5px] font-medium text-foreground/80">
                              تا {toFa(new Date(heldUntil).getHours())}:۰۰
                            </span>
                          )}
                          {nextAt && isFreeAtHour === null && (
                            <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10.5px] font-medium text-foreground/80">
                              رزرو از {toFa(new Date(nextAt).getHours())}:۰۰
                            </span>
                          )}
                          {isFreeAtHour !== null && (
                            <span className={`rounded-full border px-2 py-0.5 text-[10.5px] font-medium ${isFreeAtHour ? "border-success/40 bg-success/10" : "border-destructive/30 bg-destructive/10"}`}>
                              {toFa(selectedHour!)}:۰۰
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {!loading && !error && glanceDate && desks.length > 0 && free === 0 && (
                <p className="mt-4 text-center text-[12px] text-muted-foreground">
                  این بازه رزرو موقت دارد — ۱۰ دقیقه دیگر اگر پرداخت نشود آزاد می‌شود. زمان دیگری
                  انتخاب کن.
                </p>
              )}
            </div>

            {selected && (
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
                      <span aria-live="polite">
                        {selected.displayStatus === "held" ? "رزرو موقت" : labels[selected.displayStatus]} ·{" "}
                        {toman(unitPriceForType(pricing, "hourly"))}
                      </span>
                    </div>
                  </div>
                </div>
                {(() => {
                  const isSelectedMaintenance = selected.displayStatus === "busy" && selected.reservedIntervals.length === 0;
                  const isFreeAtSelectedHour = selectedHour !== null ? (() => {
                    if (isSelectedMaintenance) return false;
                    const hs = iranDateTime(timelineDateStr, selectedHour);
                    const he = iranDateTime(timelineDateStr, selectedHour + 1);
                    return !selected.reservedIntervals.some((iv) => overlaps(hs, he, iv.startAt, iv.endAt));
                  })() : null;
                  const canBook = isFreeAtSelectedHour !== null ? isFreeAtSelectedHour : selected.displayStatus === "free";
                  return (
                    <Button
                      className="shrink-0 h-11 rounded-full px-6"
                      disabled={!canBook}
                      onClick={() => {
                        const selDate = glanceDate ?? timelineDate;
                        const type = selectedHour !== null ? "hourly" as const : (preferredType ?? "hourly");
                        setSelected(null);
                        open({ type, desk: selected, date: selDate });
                      }}
                    >
                      {canBook ? "رزرو این میز" : "در دسترس نیست"}
                    </Button>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
