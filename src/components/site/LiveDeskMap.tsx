import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CalendarIcon, Clock } from "lucide-react";
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
  const [showGlance, setShowGlance] = useState(false);
  const [glanceDate, setGlanceDate] = useState<Date | null>(null);

  const glanceWindow = useMemo(() => {
    if (!glanceDate) return null;
    const ds = format(glanceDate, "yyyy-MM-dd");
    return {
      windowStart: iranDateTime(ds, BUSINESS_HOUR_START),
      windowEnd: iranDateTime(ds, BUSINESS_HOUR_END),
    };
  }, [glanceDate]);

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
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-hairline px-5 py-3">
              <div className="min-w-0 truncate text-[12px] font-medium text-muted-foreground">
                نقشه‌ی سالن · دفتر مرکزی آغاز
              </div>
              <div className="shrink-0 text-[11px] text-muted-foreground">
                {loading ? "در حال به‌روزرسانی…" : "به‌روز"}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-b border-hairline bg-surface/30 px-4 py-3">
              {!showGlance ? (
                <button
                  type="button"
                  aria-expanded={showGlance}
                  aria-controls="glance-panel"
                  onClick={() => setShowGlance(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-hairline bg-card px-4 py-2.5 text-[12px] text-muted-foreground transition hover:bg-surface"
                >
                  <CalendarIcon className="h-3.5 w-3.5" />
                  دیدن در تاریخ دیگر
                </button>
              ) : (
                <div id="glance-panel" className="flex flex-wrap items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="h-11 justify-start rounded-xl border-hairline text-right font-normal text-[12.5px]"
                      >
                        <CalendarIcon className="ml-2 h-3.5 w-3.5" />
                        {glanceDate ? faJalaliDate(glanceDate) : "انتخاب تاریخ"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <PersianCalendar
                        mode="single"
                        selected={glanceDate ?? undefined}
                        onSelect={(d) => setGlanceDate(d ?? null)}
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
                  {glanceDate && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface/60 px-2.5 py-1 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      نمایش: {faJalaliDate(glanceDate)}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-11 rounded-full px-4 text-[12px]"
                    onClick={() => {
                      setGlanceDate(null);
                      setShowGlance(false);
                    }}
                  >
                    حذف
                  </Button>
                </div>
              )}
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
                    const deskMeta = DESK_DISPLAY_META[d.displayStatus];
                    const isFree = d.displayStatus === "free";
                    const isSelected = selected?.id === d.id;
                    const nextAt = isFree ? nextReservationAt(d) : null;
                    const heldUntil = d.displayStatus === "held" ? d.reservedIntervals[0]?.endAt : null;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        aria-label={`${d.name} ${d.zone} ${labels[d.displayStatus]}${heldUntil ? ` تا ${new Date(heldUntil).getHours()}:۰۰` : ""}`}
                        aria-pressed={isSelected}
                        onClick={() => setSelected(d)}
                        className={`group cursor-pointer rounded-2xl border p-3 text-right transition ${deskMeta.cell} ${
                          d.displayStatus === "held" ? "border-dashed" : ""
                        } ${isFree ? "" : "opacity-90"} ${isSelected ? "ring-2 ring-primary ring-offset-1 ring-offset-card" : ""}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13.5px] font-semibold">{d.name}</span>
                          <span className={`h-2 w-2 shrink-0 rounded-full ${deskMeta.dot}`} />
                        </div>
                        <div className="mt-1 truncate text-[11px] text-muted-foreground">
                          {d.zone}
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-foreground/70">
                          <span>{d.displayStatus === "held" ? "رزرو موقت" : labels[d.displayStatus]}</span>
                          {d.displayStatus === "held" && heldUntil && (
                            <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10.5px] font-medium text-foreground/80">
                              تا {toFa(new Date(heldUntil).getHours())}:۰۰
                            </span>
                          )}
                          {nextAt && (
                            <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10.5px] font-medium text-foreground/80">
                              رزرو از {toFa(new Date(nextAt).getHours())}:۰۰
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
                <Button
                  className="shrink-0 h-11 rounded-full px-6"
                  disabled={selected.displayStatus !== "free"}
                  onClick={() => {
                    const type = preferredType ?? "hourly";
                    setSelected(null);
                    open({ type, desk: selected });
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
