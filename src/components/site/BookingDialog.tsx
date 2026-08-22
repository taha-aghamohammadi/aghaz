import * as React from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  ArrowLeft,
  CalendarIcon,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Loader2,
  Minus,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PersianCalendar } from "@/components/ui/persian-calendar";
import {
  DESK_DISPLAY_META,
  DESK_LABELS,
  type DeskAvailabilityMode,
} from "@/components/site/desk-display-meta";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { type Receipt } from "@/components/site/receipt-document";
import { createUserBooking, listPublicDesks, type PublicDesk } from "@/lib/booking.functions";
import { submitReceipt } from "@/lib/receipt.functions";
import {
  BUSINESS_HOUR_END,
  BUSINESS_HOUR_START,
  DEFAULT_PRICING,
  iranDateTime,
  tryBuildWindow,
  unitPriceForType,
  type PricingTiers,
} from "@/lib/booking.service";
import {
  faJalaliDate,
  faJalaliDateTime,
  formatCardNumber,
  validateReceiptFile,
} from "@/lib/fa-format";
import QRCode from "qrcode";

export type BookingType = "hourly" | "daily" | "monthly";

export type BookingOpenOptions = {
  type?: BookingType;
  desk?: PublicDesk;
  date?: Date;
};

type Ctx = {
  open: (options?: BookingOpenOptions) => void;
  preferredType: BookingType | null;
  prepareTier: (type: BookingType) => void;
};
const BookingCtx = createContext<Ctx | null>(null);

const PENDING_BOOKING_KEY = "aghaz_pending_booking";

export function useBooking() {
  const c = useContext(BookingCtx);
  if (!c) throw new Error("BookingProvider missing");
  return c;
}

const toFa = (n: number | string) => String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);

const HOURS = Array.from(
  { length: BUSINESS_HOUR_END - BUSINESS_HOUR_START },
  (_, i) => BUSINESS_HOUR_START + i,
);

function Row({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[12.5px] text-muted-foreground">
      <span>{label}</span>
      <span className="text-foreground" dir={ltr ? "ltr" : undefined}>
        {value}
      </span>
    </div>
  );
}

function formatToman(v: number) {
  if (v >= 1_000_000) {
    const m = v / 1_000_000;
    return `${toFa(m.toFixed(m % 1 === 0 ? 0 : 1).replace(".", "٫"))} میلیون تومان`;
  }
  if (v >= 1_000) return `${toFa((v / 1_000).toLocaleString("en-US"))} هزار تومان`;
  return `${toFa(v)} تومان`;
}

function typeMeta(pricing: PricingTiers, type: BookingType) {
  const price = unitPriceForType(pricing, type);
  if (type === "hourly")
    return {
      label: "ساعتی",
      hint: "پرداخت بر اساس ساعت",
      price,
      unit: "ساعت",
    };
  if (type === "daily")
    return {
      label: "روزانه",
      hint: "یک روز کامل کاری",
      price,
      unit: "روز",
    };
  return {
    label: "ماهانه",
    hint: "دسترسی نامحدود",
    price,
    unit: "ماه",
  };
}

function DeskLegend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-[11.5px] transition",
        active
          ? "border-primary/60 bg-primary/10 text-primary"
          : "border-hairline bg-card text-muted-foreground hover:bg-surface",
      )}
    >
      {children}
    </button>
  );
}

export function BookingProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const submitBooking = useServerFn(createUserBooking);
  const fetchDesks = useServerFn(listPublicDesks);
  const sendReceipt = useServerFn(submitReceipt);

  const [open, setOpen] = useState(false);
  const [selectedDesks, setSelectedDesks] = useState<PublicDesk[]>([]);
  const [pricing, setPricing] = useState<PricingTiers>(DEFAULT_PRICING);
  const [availableDesks, setAvailableDesks] = useState<PublicDesk[]>([]);
  const [desksLoading, setDesksLoading] = useState(false);
  const [type, setType] = useState<BookingType>("hourly");
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [startHour, setStartHour] = useState(9);
  const [duration, setDuration] = useState(2);
  const [months, setMonths] = useState(1);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [preferredType, setPreferredType] = useState<BookingType | null>(null);
  const [cardInfo, setCardInfo] = useState({ cardNumber: "", cardHolder: "" });
  const [paymentDone, setPaymentDone] = useState(false);
  const [cardFile, setCardFile] = useState<File | null>(null);
  const [submittingReceipt, setSubmittingReceipt] = useState(false);
  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState("");
  const errorRef = React.useRef<HTMLDivElement>(null);

  const [zoneFilter, setZoneFilter] = useState("");
  const [featureFilter, setFeatureFilter] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) {
        if (active) setCustomerName("");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      if (active)
        setCustomerName(
          profile?.full_name || (user.user_metadata?.full_name as string | undefined) || "",
        );
    };
    void load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => void load());
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const tryResumePending = useCallback(async () => {
    const raw = sessionStorage.getItem(PENDING_BOOKING_KEY);
    if (!raw) return;
    sessionStorage.removeItem(PENDING_BOOKING_KEY);
    try {
      const pending = JSON.parse(raw) as {
        desks: PublicDesk[];
        type: BookingType;
        dateStr: string;
        startHour: number;
        duration: number;
        months: number;
      };
      setSelectedDesks(pending.desks);
      setType(pending.type);
      setDate(new Date(pending.dateStr + "T12:00:00"));
      setStartHour(pending.startHour);
      setDuration(pending.duration);
      setMonths(pending.months);
      setReceipt(null);
      setOpen(true);
      toast.message("ادامه رزرو", { description: "ورود موفق بود. رزرو را تأیید کنید." });
    } catch {
      /* ignore corrupt pending state */
    }
  }, []);

  useEffect(() => {
    void tryResumePending();
  }, [tryResumePending]);

  const prepareTier = useCallback((tier: BookingType) => {
    setPreferredType(tier);
  }, []);

  const openFn = useCallback(
    (options?: BookingOpenOptions) => {
      if (options?.desk) {
        setSelectedDesks([options.desk]);
        setType(options.type ?? preferredType ?? "hourly");
        setPreferredType(null);
      } else {
        setSelectedDesks([]);
        setType(options?.type ?? "hourly");
      }
      setDate(options?.date ?? new Date());
      setReceipt(null);
      setPaymentDone(false);
      setCardFile(null);
      setCreatedBookingId(null);
      setSubmitError("");
      setOpen(true);
    },
    [preferredType],
  );

  const bookingWindow = useMemo(() => {
    if (!date) return null;
    return tryBuildWindow({
      bookingType: type,
      dateStr: format(date, "yyyy-MM-dd"),
      startHour: type === "hourly" ? startHour : undefined,
      duration: type !== "monthly" ? duration : undefined,
      months: type === "monthly" ? months : undefined,
    });
  }, [type, date, startHour, duration, months]);

  useEffect(() => {
    if (!open || receipt) return;
    let active = true;
    const load = (params: { windowStart?: string; windowEnd?: string }) =>
      fetchDesks({ data: params })
        .then((res) => {
          if (!active) return;
          setPricing(res.pricing);
          setCardInfo({ cardNumber: res.cardNumber ?? "", cardHolder: res.cardHolder ?? "" });
          setAvailableDesks(res.desks);
        })
        .catch(() => {
          if (!active) return;
          setPricing(DEFAULT_PRICING);
          setAvailableDesks([]);
        })
        .finally(() => {
          if (active) setDesksLoading(false);
        });
    setDesksLoading(true);
    const win = bookingWindow;
    const needsWindow = win !== null;
    if (needsWindow) {
      const t = setTimeout(
        () => void load({ windowStart: win.startAt, windowEnd: win.endAt }),
        300,
      );
      return () => {
        active = false;
        clearTimeout(t);
      };
    }
    void load({});
    return () => {
      active = false;
    };
  }, [open, selectedDesks.length, receipt, fetchDesks, bookingWindow]);

  const ctx = useMemo(
    () => ({ open: openFn, preferredType, prepareTier }),
    [openFn, preferredType, prepareTier],
  );

  const current = typeMeta(pricing, type);
  const units = useMemo(() => {
    if (type === "hourly") return duration;
    if (type === "daily") return duration;
    return months;
  }, [type, duration, months]);

  const total = useMemo(() => {
    if (selectedDesks.length === 0) return 0;
    const perDesk = current.price * units;
    return perDesk * selectedDesks.length;
  }, [current.price, units, selectedDesks.length]);

  const toggleDesk = useCallback((desk: PublicDesk) => {
    setSelectedDesks((prev) => {
      const idx = prev.findIndex((d) => d.id === desk.id);
      if (idx >= 0) {
        return prev.filter((d) => d.id !== desk.id);
      }
      return [...prev, desk];
    });
  }, []);

  const endHour = Math.min(BUSINESS_HOUR_END, startHour + duration);

  const allZones = useMemo(
    () => Array.from(new Set(availableDesks.map((d) => d.zone).filter(Boolean))).sort(),
    [availableDesks],
  );
  const allFeatures = useMemo(
    () => Array.from(new Set(availableDesks.flatMap((d) => d.features))).sort(),
    [availableDesks],
  );
  const filteredDesks = useMemo(
    () =>
      availableDesks.filter(
        (d) =>
          (!zoneFilter || d.zone === zoneFilter) &&
          (!featureFilter || d.features.includes(featureFilter)),
      ),
    [availableDesks, zoneFilter, featureFilter],
  );

  const labelsMode: DeskAvailabilityMode = "window";

  const types: BookingType[] = ["hourly", "daily", "monthly"];

  const selectedIds = useMemo(() => new Set(selectedDesks.map((d) => d.id)), [selectedDesks]);
  const atCap = selectedDesks.length >= pricing.maxDesksPerBooking;
  const deskConflict = selectedDesks.some(
    (sd) =>
      !desksLoading && availableDesks.some((d) => d.id === sd.id && d.displayStatus !== "free"),
  );

  const tehranNow = useMemo(() => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tehran",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date());
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
    return { dateStr: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
  }, []);

  const dateIsToday = !!date && format(date, "yyyy-MM-dd") === tehranNow.dateStr;
  const minStartHour = dateIsToday
    ? Math.max(BUSINESS_HOUR_START, tehranNow.hour + 1)
    : BUSINESS_HOUR_START;

  useEffect(() => {
    if (!dateIsToday) return;
    if (minStartHour >= BUSINESS_HOUR_END) {
      const next = new Date(date);
      next.setDate(next.getDate() + 1);
      setDate(next);
      return;
    }
    if (startHour < minStartHour) setStartHour(minStartHour);
  }, [dateIsToday, minStartHour, startHour, date]);

  useEffect(() => {
    const maxDuration = Math.min(12, BUSINESS_HOUR_END - startHour);
    if (duration > maxDuration) setDuration(maxDuration);
  }, [startHour, duration]);

  const deskGrid = (
    <div>
      <div className="text-[11px] font-medium tracking-widest text-muted-foreground">
        انتخاب میز
      </div>
      <div className="mt-2 flex flex-wrap gap-3">
        <DeskLegend color="bg-success" label={DESK_LABELS[labelsMode].free} />
        <DeskLegend color="bg-warning" label={DESK_LABELS[labelsMode].held} />
        <DeskLegend color="bg-destructive" label={DESK_LABELS[labelsMode].busy} />
        <DeskLegend color="bg-blue-500" label={DESK_LABELS[labelsMode].selected} />
      </div>
      {(allZones.length > 0 || allFeatures.length > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <FilterChip active={!zoneFilter} onClick={() => setZoneFilter("")}>
            همه‌ی میزها
          </FilterChip>
          {allZones.map((z) => (
            <FilterChip key={z} active={zoneFilter === z} onClick={() => setZoneFilter(z)}>
              {z}
            </FilterChip>
          ))}
          {allFeatures.map((f) => (
            <FilterChip key={f} active={featureFilter === f} onClick={() => setFeatureFilter(f)}>
              {f}
            </FilterChip>
          ))}
        </div>
      )}
      {desksLoading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          بارگذاری میزها…
        </div>
      ) : filteredDesks.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-muted-foreground">
          میزی مطابق فیلتر پیدا نشد.
        </p>
      ) : (
        <div
          className="mt-3 grid gap-2 sm:grid-cols-2"
          role="group"
          aria-label="لیست میزها"
          aria-multiselectable="true"
        >
          {filteredDesks.map((d) => {
            const isSelected = selectedIds.has(d.id);
            const meta = isSelected
              ? DESK_DISPLAY_META.selected
              : DESK_DISPLAY_META[d.displayStatus];
            const isHeld = d.displayStatus === "held";
            const isBusy = d.displayStatus === "busy";
            const capBlocked = atCap && !isSelected;
            const cannotSelect = isBusy || isHeld || capBlocked;
            const selectIndex = isSelected
              ? selectedDesks.findIndex((sd) => sd.id === d.id)
              : -1;
            const heldUntil = isHeld ? d.reservedIntervals[0]?.endAt : null;
            const busyUntil = isBusy ? d.reservedIntervals[0]?.endAt : null;
            return (
              <button
                key={d.id}
                type="button"
                aria-pressed={isSelected}
                aria-disabled={cannotSelect || undefined}
                aria-describedby={capBlocked ? "cap-hint" : undefined}
                title={
                  capBlocked
                    ? `حداکثر ${toFa(pricing.maxDesksPerBooking)} میز`
                    : isHeld
                      ? "در این بازه رزرو موقت دارد"
                      : undefined
                }
                onClick={() => toggleDesk(d)}
                className={cn(
                  "relative rounded-xl border p-3 text-right transition",
                  meta.cell,
                  isHeld && !isSelected ? "border-dashed" : "",
                  cannotSelect ? "cursor-not-allowed opacity-75" : "cursor-pointer",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13.5px] font-semibold">{d.name}</span>
                  <div className="flex items-center gap-1.5">
                    {isSelected && (
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-blue-500 text-[10px] font-bold text-white">
                        {toFa(selectIndex + 1)}
                      </span>
                    )}
                    <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", meta.dot)} />
                  </div>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground">{d.zone}</span>
                  <span className="text-[11px] font-medium text-foreground/80">{meta.label}</span>
                </div>
                {heldUntil && (
                  <span className="mt-1.5 inline-flex rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10.5px] font-medium text-foreground/80">
                    تا {toFa(new Date(heldUntil).getHours())}:۰۰
                  </span>
                )}
                {busyUntil && (
                  <span className="mt-1.5 inline-flex rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10.5px] font-medium text-foreground/80">
                    پر تا {toFa(new Date(busyUntil).getHours())}:۰۰
                  </span>
                )}
                <div className="mt-1 text-[11px] text-muted-foreground" dir="ltr">
                  {d.code}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  const timeControls = (
    <>
      <div className="text-[11px] font-medium tracking-widest text-muted-foreground">نوع رزرو</div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {types.map((tid) => {
          const t = typeMeta(pricing, tid);
          const active = tid === type;
          return (
            <button
              key={tid}
              type="button"
              aria-pressed={active}
              onClick={() => setType(tid)}
              className={cn(
                "rounded-xl border p-3 text-right transition",
                active
                  ? "border-primary/60 bg-primary/5 ring-1 ring-primary/30"
                  : "border-hairline bg-card hover:bg-surface",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[13.5px] font-semibold">{t.label}</span>
                {active && (
                  <span className="grid h-4 w-4 place-items-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-2.5 w-2.5" />
                  </span>
                )}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">{t.hint}</div>
              <div className="mt-2 text-[11.5px] text-foreground/80">
                {formatToman(t.price)}
                <span className="text-muted-foreground"> / {t.unit}</span>
              </div>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {[
          { label: "۲ ساعت", type: "hourly" as const, duration: 2, suffix: "۱۸۰ هزار", startHour: minStartHour },
          { label: "۴ ساعت", type: "hourly" as const, duration: 4, suffix: "۳۶۰ هزار", startHour: minStartHour },
          { label: "روز کامل", type: "daily" as const, duration: 1, suffix: "۵۹۰ هزار" },
          { label: "۳ روز", type: "daily" as const, duration: 3, suffix: "۱٫۷ میلیون" },
        ].map((p) => {
          const active =
            (p.type === "hourly" && type === "hourly" && duration === p.duration) ||
            (p.type === "daily" && type === "daily" && duration === p.duration);
          return (
            <button
              key={p.label}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setType(p.type);
                if (p.type === "hourly") {
                  setStartHour(p.startHour);
                  setDuration(p.duration);
                } else {
                  setDuration(p.duration);
                }
              }}
              className={cn(
                "h-11 rounded-full border px-4 text-[12px] transition",
                active
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : "border-hairline bg-card text-muted-foreground hover:bg-surface",
              )}
            >
              {p.label} · {p.suffix}
            </button>
          );
        })}
      </div>

      <div className="mt-6 text-[11px] font-medium tracking-widest text-muted-foreground">
        {type === "monthly" ? "تاریخ شروع اشتراک" : "تاریخ رزرو"}
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "mt-2 h-11 w-full justify-start rounded-xl border-hairline text-right font-normal",
              !date && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="ml-2 h-4 w-4" />
            {date ? faJalaliDate(date) : "تاریخ رو انتخاب کن"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <PersianCalendar
            mode="single"
            selected={date}
            onSelect={setDate}
            disabled={(d) => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              return d < today;
            }}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>

      {type === "hourly" && (
        <>
          <div className="mt-6 text-[11px] font-medium tracking-widest text-muted-foreground">
            ساعت شروع
          </div>
          <div
            className="mt-2 grid grid-cols-5 gap-1.5 sm:grid-cols-7"
            dir="ltr"
            role="group"
            aria-label="ساعت شروع"
          >
            {HOURS.map((h) => {
              const active = h === startHour;
              const isPast = dateIsToday && h < minStartHour;
              return (
                <button
                  key={h}
                  type="button"
                  disabled={isPast}
                  aria-pressed={active}
                  onClick={() => setStartHour(h)}
                  className={cn(
                    "rounded-lg border px-2 py-2.5 text-[12px] transition",
                    active
                      ? "border-primary/60 bg-primary text-primary-foreground"
                      : isPast
                        ? "cursor-not-allowed border-hairline bg-card text-muted-foreground/40"
                        : "border-hairline bg-card hover:bg-surface",
                  )}
                >
                  {toFa(h)}:۰۰
                </button>
              );
            })}
          </div>

          <Stepper
            className="mt-5"
            label="مدت زمان"
            value={duration}
            min={1}
            max={Math.min(12, BUSINESS_HOUR_END - startHour)}
            onChange={setDuration}
            suffix="ساعت"
          />
          {type === "hourly" && duration > 6 && (
            <button
              type="button"
              onClick={() => {
                setType("daily");
                setDuration(1);
              }}
              className="mt-3 text-[12px] text-primary underline decoration-dotted underline-offset-4"
            >
              روز کامل به‌صرفه‌تره — تبدیل به روزانه؟
            </button>
          )}
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface/60 px-2.5 py-1 text-[11.5px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span dir="ltr">
              {toFa(startHour)}:۰۰ – {toFa(endHour)}:۰۰
            </span>
          </div>
        </>
      )}

      {type === "daily" && (
        <Stepper
          className="mt-6"
          label="تعداد روز"
          value={duration}
          min={1}
          max={30}
          onChange={setDuration}
          suffix="روز"
        />
      )}

      {type === "monthly" && (
        <Stepper
          className="mt-6"
          label="مدت اشتراک"
          value={months}
          min={1}
          max={12}
          onChange={setMonths}
          suffix="ماه"
        />
      )}
    </>
  );

  const handleConfirm = async () => {
    if (selectedDesks.length === 0) {
      toast.error("ابتدا یک میز از نقشه انتخاب کنید");
      return;
    }
    if (!date) {
      toast.error("لطفاً تاریخ رزرو رو انتخاب کن");
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      const dateStr = format(date, "yyyy-MM-dd");
      sessionStorage.setItem(
        PENDING_BOOKING_KEY,
        JSON.stringify({
          desks: selectedDesks,
          type,
          dateStr,
          startHour,
          duration,
          months,
        }),
      );
      navigate({ to: "/auth", search: { redirect: "/" } });
      toast.message("برای رزرو وارد شوید");
      return;
    }

    setConfirming(true);
    try {
      const dateStr = format(date, "yyyy-MM-dd");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = await submitBooking({
        data: {
          deskIds: selectedDesks.map((d) => d.id),
          bookingType: type,
          dateStr,
          startHour: type === "hourly" ? startHour : undefined,
          duration: type !== "monthly" ? duration : undefined,
          months: type === "monthly" ? months : undefined,
        },
      });
      if (result.unavailableDeskCodes?.length) {
        const msg = `میزهای ${result.unavailableDeskCodes.join(", ")} در بازه‌ی انتخابی رزرو شده‌اند.`;
        setSubmitError(msg);
        toast.error(msg);
        requestAnimationFrame(() => errorRef.current?.focus());
        return;
      }
      const row = result as { id: string; code: string; unit_price: number; total_amount: number };
      setCreatedBookingId(row.id);
      setPaymentDone(false);

      const dateLabel = faJalaliDate(date);
      let details = "";
      if (type === "hourly") {
        details = `${dateLabel} · ${toFa(startHour)}:۰۰ تا ${toFa(endHour)}:۰۰`;
      } else if (type === "daily") {
        details = `${dateLabel} · ${toFa(duration)} روز`;
      } else {
        details = `شروع ${dateLabel} · ${toFa(months)} ماه`;
      }

      const code = row.code;
      const payload =
        typeof window !== "undefined"
          ? `${window.location.origin}/checkin?code=${code}`
          : `AGHAZ-CHECKIN:${code}`;
      let qrDataUrl = "";
      try {
        qrDataUrl = await QRCode.toDataURL(payload, {
          margin: 1,
          width: 480,
          errorCorrectionLevel: "M",
          color: { dark: "#0b0b0f", light: "#ffffff" },
        });
      } catch {
        /* optional */
      }

      const deskLabel =
        selectedDesks.length === 1
          ? `${selectedDesks[0].code} · ${selectedDesks[0].name}`
          : `${selectedDesks.length} میز`;

      setReceipt({
        code,
        customerName: customerName || "مهمان",
        planLabel: current.label,
        dateLabel,
        details,
        timeRange: type === "hourly" ? `${toFa(startHour)}:۰۰ – ${toFa(endHour)}:۰۰` : null,
        quantity:
          type === "hourly"
            ? `${toFa(duration)} ساعت`
            : type === "daily"
              ? `${toFa(duration)} روز`
              : `${toFa(months)} ماه`,
        unitPrice: row.unit_price,
        unit: current.unit,
        total: row.total_amount,
        issuedAt: faJalaliDateTime(new Date()),
        qrDataUrl,
        cardNumber: cardInfo.cardNumber || undefined,
        cardHolder: cardInfo.cardHolder || undefined,
        statusLabel: "در انتظار تأیید",
        paymentLabel: "پرداخت‌نشده",
      });
      toast.success("رزرو ثبت شد", {
        description: deskLabel + " — پس از تأیید توسط پذیرش، رزرو نهایی می‌شود.",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "ثبت رزرو ناموفق بود";
      setSubmitError(msg);
      toast.error(msg);
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setConfirming(false);
    }
  };

  const handleSubmitReceipt = async () => {
    if (!createdBookingId) {
      toast.error("رزرو مشخص نشده است.");
      return;
    }
    if (!cardFile) {
      toast.error("ابتدا تصویر رسید را انتخاب کنید.");
      return;
    }
    setSubmittingReceipt(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.error("ابتدا وارد شوید.");
        return;
      }
      const ext = cardFile.name.split(".").pop() || "jpg";
      const path = `${userData.user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("receipts").upload(path, cardFile, {
        contentType: cardFile.type || undefined,
      });
      if (upErr) throw new Error("آپلود تصویر رسید ناموفق بود.");
      await sendReceipt({ data: { bookingId: createdBookingId, imagePath: path } });
      setPaymentDone(true);
      toast.success("رسید ارسال شد و در انتظار بررسی مدیر است.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ارسال رسید ناموفق بود");
    } finally {
      setSubmittingReceipt(false);
    }
  };

  return (
    <BookingCtx.Provider value={ctx}>
      {children}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            requestAnimationFrame(() => {
              const firstDesk = document.querySelector<HTMLElement>("#desks [role='list'] button");
              firstDesk?.focus();
            });
          }
        }}
      >
        <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden" dir="rtl">
          <DialogHeader className="border-b border-hairline px-6 py-4 text-right space-y-1">
            <DialogTitle className="text-[17px]">
              {receipt ? "رزرو ثبت شد" : "رزرو میز اشتراکی"}
            </DialogTitle>
            <DialogDescription className="text-[12.5px]">
              {receipt
                ? paymentDone
                  ? "رزرو شما ثبت شد و در انتظار تأیید پذیرش است."
                  : "برای نهایی‌کردن رزرو، رسید واریز را ارسال کنید."
                : selectedDesks.length > 0
                  ? `${selectedDesks.length} میز انتخاب شده`
                  : "اول نوع رزرو و بازه رو انتخاب کن، بعد میزت رو ببین."}
            </DialogDescription>
          </DialogHeader>

          {receipt && !paymentDone ? (
            <>
              <div className="max-h-[70vh] overflow-y-auto px-6 py-6">
                <div className="flex flex-col items-center text-center">
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/25">
                    <CheckCircle2 className="h-7 w-7" />
                  </span>
                  <div className="mt-3 text-[15px] font-semibold">رزرو شما ثبت شد</div>
                  <div className="mt-1 text-[12.5px] text-muted-foreground">
                    {receipt.issuedAt} · {receipt.code}
                  </div>
                </div>

                <div className="mt-5 text-[11px] font-medium tracking-widest text-muted-foreground">
                  روش پرداخت
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    disabled
                    aria-disabled
                    title="به‌زودی"
                    className="cursor-not-allowed rounded-xl border border-hairline bg-surface p-3 text-right opacity-50"
                  >
                    <div className="text-[13px] font-semibold">پرداخت آنلاین</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">به‌زودی</div>
                  </button>
                  <button
                    type="button"
                    disabled
                    aria-disabled
                    title="به‌زودی"
                    className="cursor-not-allowed rounded-xl border border-hairline bg-surface p-3 text-right opacity-50"
                  >
                    <div className="text-[13px] font-semibold">کیف پول</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">به‌زودی</div>
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-primary/60 bg-primary/5 p-3 text-right ring-1 ring-primary/30"
                  >
                    <div className="text-[13px] font-semibold">کارت به کارت</div>
                    <div className="mt-1 text-[11px] text-foreground/80">واریز و ارسال رسید</div>
                  </button>
                </div>

                <div className="mt-6 rounded-xl border border-hairline bg-surface/50 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] tracking-widest text-muted-foreground">
                      مبلغ قابل پرداخت
                    </div>
                    <div className="text-[16px] font-semibold">{formatToman(receipt.total)}</div>
                  </div>
                  {cardInfo.cardNumber ? (
                    <div className="mt-4">
                      <div className="text-[11px] tracking-widest text-muted-foreground">
                        شماره کارت
                      </div>
                      <div className="mt-2 flex items-center justify-between rounded-xl border border-hairline bg-background p-3">
                        <span
                          className="font-mono text-[18px] font-semibold tracking-widest"
                          dir="ltr"
                        >
                          {toFa(formatCardNumber(cardInfo.cardNumber))}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full border-hairline"
                          onClick={() => {
                            navigator.clipboard?.writeText(cardInfo.cardNumber);
                            toast.success("شماره کارت کپی شد");
                          }}
                        >
                          <Copy className="ml-1.5 h-3.5 w-3.5" />
                          کپی
                        </Button>
                      </div>
                      {cardInfo.cardHolder && (
                        <div className="mt-2 text-[13px] font-medium">{cardInfo.cardHolder}</div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-xl border border-hairline bg-background p-3 text-[12.5px] text-muted-foreground">
                      شماره کارت هنوز ثبت نشده است.
                    </div>
                  )}

                  <div className="mt-4">
                    <Label htmlFor="receipt-file">تصویر رسید واریز</Label>
                    <Input
                      id="receipt-file"
                      type="file"
                      accept="image/*"
                      aria-label="تصویر رسید واریز"
                      className="mt-2"
                      disabled={!cardInfo.cardNumber}
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        if (file) {
                          const err = validateReceiptFile(file);
                          if (err) {
                            toast.error(err);
                            setCardFile(null);
                            return;
                          }
                        }
                        setCardFile(file);
                      }}
                    />
                  </div>
                </div>

                <p className="mt-4 text-center text-[11px] text-muted-foreground">
                  برای ارسال اولیه‌ی رسید فقط ۱۰ دقیقه فرصت دارید.
                </p>
              </div>

              <DialogFooter className="flex-row-reverse gap-2 border-t border-hairline bg-surface/40 px-6 py-4">
                <Button
                  onClick={handleSubmitReceipt}
                  disabled={!cardFile || !cardInfo.cardNumber || submittingReceipt}
                  className="rounded-full"
                >
                  {submittingReceipt && <Loader2 className="ml-1.5 h-4 w-4 animate-spin" />}
                  ارسال رسید
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                  className="rounded-full border-hairline"
                >
                  بعداً
                </Button>
              </DialogFooter>
            </>
          ) : receipt ? (
            <>
              <div className="max-h-[70vh] overflow-y-auto px-6 py-6">
                <div className="flex flex-col items-center text-center">
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/25">
                    <CheckCircle2 className="h-7 w-7" />
                  </span>
                  <div className="mt-3 text-[15px] font-semibold">رزرو شما ثبت شد</div>
                  <div className="mt-1 text-[12.5px] text-muted-foreground">{receipt.issuedAt}</div>
                </div>

                <div className="mt-5 flex items-center justify-between rounded-xl border border-hairline bg-surface/60 p-4">
                  <div>
                    <div className="text-[11px] tracking-widest text-muted-foreground">
                      شماره رزرو
                    </div>
                    <div className="mt-1 font-mono text-[16px] font-semibold" dir="ltr">
                      {receipt.code}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full border-hairline"
                    onClick={() => {
                      navigator.clipboard?.writeText(receipt.code);
                      toast.success("شماره رزرو کپی شد");
                    }}
                  >
                    <Copy className="ml-1.5 h-3.5 w-3.5" />
                    کپی
                  </Button>
                </div>

                <div className="mt-4 rounded-xl border border-hairline p-4">
                  <div className="text-[11px] tracking-widest text-muted-foreground">
                    جزئیات رزرو
                  </div>
                  <div className="mt-3 space-y-2">
                    <Row label="نام و نام خانوادگی" value={receipt.customerName} />
                    <Row label="پلن" value={receipt.planLabel} />
                    <Row label="تاریخ" value={receipt.dateLabel} />
                    {receipt.timeRange && <Row label="بازه ساعتی" value={receipt.timeRange} ltr />}
                    <Row label="مدت" value={receipt.quantity} />
                    <Row
                      label="میز"
                      value={
                        selectedDesks.length > 0 ? selectedDesks.map((d) => d.code).join(", ") : "—"
                      }
                    />
                    <Row label="وضعیت" value={receipt.statusLabel ?? "در انتظار تأیید"} />
                    <Row
                      label="پرداخت"
                      value={
                        paymentDone
                          ? "در انتظار بررسی مدیر"
                          : (receipt.paymentLabel ?? "پرداخت‌نشده")
                      }
                    />
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-hairline bg-surface/50 p-4">
                  <div className="text-[11px] tracking-widest text-muted-foreground">
                    خلاصه مبلغ
                  </div>
                  <div className="mt-3 space-y-2">
                    <Row
                      label={`تعرفه (${formatToman(receipt.unitPrice)} / ${receipt.unit})`}
                      value={receipt.quantity}
                    />
                    <Row label="مالیات و کارمزد" value="۰ تومان" />
                  </div>
                  <div className="my-3 h-px bg-hairline" />
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium">مبلغ قابل پرداخت</span>
                    <span className="text-[16px] font-semibold">{formatToman(receipt.total)}</span>
                  </div>
                </div>
              </div>

              <DialogFooter className="flex-row-reverse gap-2 border-t border-hairline bg-surface/40 px-6 py-4">
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                  className="rounded-full border-hairline"
                >
                  باشه، تمام
                </Button>
                <Button variant="ghost" onClick={() => setReceipt(null)} className="rounded-full">
                  رزرو جدید
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
                <div className="space-y-6">{timeControls}</div>
                {deskGrid}
                <span id="cap-hint" className="sr-only">
                  حداکثر {toFa(pricing.maxDesksPerBooking)} میز قابل انتخاب است
                </span>
              </div>

              {selectedDesks.length > 0 && (
                <div
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                  className="flex items-center justify-between gap-4 border-t border-hairline bg-surface/60 px-6 py-3 text-[13px]"
                >
                  <div>
                    <span className="font-medium">
                      {toFa(selectedDesks.length)} میز انتخاب شده
                    </span>
                    {atCap && (
                      <span className="mr-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10.5px] font-medium text-blue-600 dark:text-blue-400">
                        حداکثر
                      </span>
                    )}
                  </div>
                  <span className="font-semibold" aria-live="polite">
                    {formatToman(total)}
                  </span>
                </div>
              )}

              <DialogFooter className="flex-row-reverse gap-2 border-t border-hairline bg-surface/40 px-6 py-4">
                {deskConflict && (
                  <div className="w-full rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
                    یکی از میزهای انتخاب‌شده در بازه‌ی انتخابی رزرو شده است. میز دیگری انتخاب کن.
                  </div>
                )}
                <div
                  ref={errorRef}
                  role="alert"
                  tabIndex={-1}
                  className={`w-full rounded-lg border px-3 py-2 text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-destructive ${
                    submitError
                      ? "border-destructive/30 bg-destructive/10 text-destructive"
                      : "hidden"
                  }`}
                >
                  {submitError}
                </div>
                <Button
                  onClick={handleConfirm}
                  disabled={confirming || deskConflict}
                  className="h-11 rounded-full px-6"
                >
                  {confirming ? (
                    <Loader2 className="ml-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowLeft className="mr-1 h-4 w-4" />
                  )}
                  ثبت رزرو
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setOpen(false)}
                  className="h-11 rounded-full px-5"
                >
                  انصراف
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </BookingCtx.Provider>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  suffix,
  className,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  suffix: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-[11px] font-medium tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          aria-label="کاهش"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="grid h-11 w-11 place-items-center rounded-full border border-hairline bg-card text-muted-foreground transition hover:bg-surface disabled:opacity-40"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <div className="min-w-[6.5rem] rounded-lg border border-hairline bg-background px-4 py-2 text-center text-[14px] font-medium">
          {toFa(value)} {suffix}
        </div>
        <button
          type="button"
          aria-label="افزایش"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="grid h-11 w-11 place-items-center rounded-full border border-hairline bg-card text-muted-foreground transition hover:bg-surface disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
