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
  Download,
  Loader2,
  Minus,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PersianCalendar } from "@/components/ui/persian-calendar";
import { DESK_DISPLAY_META } from "@/components/site/desk-display-meta";
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
import { buildReceiptHtml, type Receipt } from "@/components/site/receipt-document";
import { createUserBooking, listPublicDesks, type PublicDesk } from "@/lib/booking.functions";
import {
  BUSINESS_HOUR_END,
  BUSINESS_HOUR_START,
  DEFAULT_PRICING,
  unitPriceForType,
  type PricingTiers,
} from "@/lib/booking.service";
import { faJalaliDate, faJalaliDateTime } from "@/lib/fa-format";
import QRCode from "qrcode";

export type BookingType = "hourly" | "daily" | "monthly";

export type BookingOpenOptions = {
  type?: BookingType;
  desk?: PublicDesk;
};

type Ctx = { open: (options?: BookingOpenOptions) => void };
const BookingCtx = createContext<Ctx | null>(null);

const PENDING_BOOKING_KEY = "aghaz_pending_booking";

export function useBooking() {
  const c = useContext(BookingCtx);
  if (!c) throw new Error("BookingProvider missing");
  return c;
}

const toFa = (n: number | string) =>
  String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);

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

export function BookingProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const submitBooking = useServerFn(createUserBooking);
  const fetchDesks = useServerFn(listPublicDesks);

  const [open, setOpen] = useState(false);
  const [selectedDesk, setSelectedDesk] = useState<PublicDesk | null>(null);
  const [pricing, setPricing] = useState<PricingTiers>(DEFAULT_PRICING);
  const [availableDesks, setAvailableDesks] = useState<PublicDesk[]>([]);
  const [desksLoading, setDesksLoading] = useState(false);
  const [type, setType] = useState<BookingType>("hourly");
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [startHour, setStartHour] = useState(9);
  const [duration, setDuration] = useState(2);
  const [months, setMonths] = useState(1);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [customerName, setCustomerName] = useState("");

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
        desk: PublicDesk;
        type: BookingType;
        dateStr: string;
        startHour: number;
        duration: number;
        months: number;
      };
      setSelectedDesk(pending.desk);
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

  const handleDownload = async () => {
    if (!receipt) return;
    setDownloading(true);
    try {
      const frame = document.createElement("iframe");
      frame.setAttribute("aria-hidden", "true");
      frame.style.cssText = "position:fixed;left:-9999px;top:0;width:794px;height:1123px;border:0";
      document.body.appendChild(frame);

      const doc = frame.contentDocument!;
      doc.open();
      doc.write(buildReceiptHtml(receipt, formatToman));
      doc.close();

      await new Promise((r) => setTimeout(r, 300));
      try {
        await (frame.contentDocument as Document & { fonts?: FontFaceSet }).fonts?.ready;
      } catch {
        /* font loading API unavailable */
      }

      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      setTimeout(() => frame.remove(), 1000);
      toast.success("رسید آماده‌ی ذخیره به‌صورت PDF است");
    } catch {
      toast.error("ساخت رسید انجام نشد، دوباره تلاش کن");
    } finally {
      setDownloading(false);
    }
  };

  const openFn = useCallback(
    (options?: BookingOpenOptions) => {
      if (options?.desk) setSelectedDesk(options.desk);
      else setSelectedDesk(null);
      if (options?.type) setType(options.type);
      setDate(new Date());
      setReceipt(null);
      setOpen(true);
    },
    [],
  );

  useEffect(() => {
    if (!open || receipt) return;
    let active = true;
    if (!selectedDesk) setDesksLoading(true);
    void fetchDesks({ data: {} })
      .then((res) => {
        if (!active) return;
        setPricing(res.pricing);
        if (!selectedDesk) setAvailableDesks(res.desks);
      })
      .catch(() => {
        if (!active) return;
        setPricing(DEFAULT_PRICING);
        if (!selectedDesk) setAvailableDesks([]);
      })
      .finally(() => {
        if (active && !selectedDesk) setDesksLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, selectedDesk, receipt, fetchDesks]);

  const ctx = useMemo(() => ({ open: openFn }), [openFn]);

  const current = typeMeta(pricing, type);

  const total = useMemo(() => {
    if (!selectedDesk) return 0;
    if (type === "hourly") return current.price * duration;
    if (type === "daily") return current.price * duration;
    return current.price * months;
  }, [type, duration, months, current, selectedDesk]);

  const endHour = Math.min(BUSINESS_HOUR_END, startHour + duration);

  const handleConfirm = async () => {
    if (!selectedDesk) {
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
          desk: selectedDesk,
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
      const row = await submitBooking({
        data: {
          deskId: selectedDesk.id,
          bookingType: type,
          dateStr,
          startHour: type === "hourly" ? startHour : undefined,
          duration: type !== "monthly" ? duration : undefined,
          months: type === "monthly" ? months : undefined,
        },
      });

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
        statusLabel: "در انتظار تأیید",
        paymentLabel: "پرداخت‌نشده",
      });
      toast.success("رزرو ثبت شد", {
        description: "پس از تأیید توسط پذیرش، رزرو نهایی می‌شود.",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ثبت رزرو ناموفق بود");
    } finally {
      setConfirming(false);
    }
  };

  const types: BookingType[] = ["hourly", "daily", "monthly"];

  return (
    <BookingCtx.Provider value={ctx}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden" dir="rtl">
          <DialogHeader className="border-b border-hairline px-6 py-4 text-right space-y-1">
            <DialogTitle className="text-[17px]">
              {receipt ? "رزرو ثبت شد" : "رزرو میز اشتراکی"}
            </DialogTitle>
            <DialogDescription className="text-[12.5px]">
              {receipt
                ? "رزرو شما ثبت شد و در انتظار تأیید پذیرش است."
                : selectedDesk
                  ? `میز ${selectedDesk.code} · ${selectedDesk.zone}`
                  : "یک میز آزاد انتخاب کنید."}
            </DialogDescription>
            {selectedDesk && !receipt && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 self-start rounded-full px-2 text-[12px] text-muted-foreground"
                onClick={() => setSelectedDesk(null)}
              >
                تغییر میز
              </Button>
            )}
          </DialogHeader>

          {receipt ? (
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
                    <div className="text-[11px] tracking-widest text-muted-foreground">شماره رزرو</div>
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
                  <div className="text-[11px] tracking-widest text-muted-foreground">جزئیات رزرو</div>
                  <div className="mt-3 space-y-2">
                    <Row label="نام و نام خانوادگی" value={receipt.customerName} />
                    <Row label="پلن" value={receipt.planLabel} />
                    <Row label="تاریخ" value={receipt.dateLabel} />
                    {receipt.timeRange && <Row label="بازه ساعتی" value={receipt.timeRange} ltr />}
                    <Row label="مدت" value={receipt.quantity} />
                    <Row
                      label="میز"
                      value={selectedDesk ? `${selectedDesk.code} · ${selectedDesk.name}` : "—"}
                    />
                    <Row label="وضعیت" value={receipt.statusLabel ?? "در انتظار تأیید"} />
                    <Row label="پرداخت" value={receipt.paymentLabel ?? "پرداخت‌نشده"} />
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-hairline bg-surface/50 p-4">
                  <div className="text-[11px] tracking-widest text-muted-foreground">خلاصه مبلغ</div>
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

                {receipt.qrDataUrl && (
                  <div className="mt-4 flex items-center gap-4 rounded-xl border border-hairline p-4">
                    <img
                      src={receipt.qrDataUrl}
                      alt="کد QR چک‌این"
                      className="h-24 w-24 rounded-lg bg-white p-1 ring-1 ring-hairline"
                    />
                    <div>
                      <div className="text-[13px] font-semibold">چک‌این سریع</div>
                      <p className="mt-1.5 text-[11.5px] leading-6 text-muted-foreground">
                        پس از تأیید رزرو، این کد برای ورود قابل استفاده است.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="flex-row-reverse gap-2 border-t border-hairline bg-surface/40 px-6 py-4">
                <Button onClick={handleDownload} disabled={downloading} className="rounded-full">
                  {downloading ? (
                    <Loader2 className="ml-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="ml-1.5 h-4 w-4" />
                  )}
                  دانلود رسید PDF
                </Button>
                <Button variant="outline" onClick={() => setOpen(false)} className="rounded-full border-hairline">
                  باشه، تمام
                </Button>
                <Button variant="ghost" onClick={() => setReceipt(null)} className="rounded-full">
                  رزرو جدید
                </Button>
              </DialogFooter>
            </>
          ) : !selectedDesk ? (
            <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
              <div className="text-[11px] font-medium tracking-widest text-muted-foreground">
                انتخاب میز
              </div>
              <div className="mt-2 flex flex-wrap gap-3">
                <DeskLegend color="bg-success" label={DESK_DISPLAY_META.free.label} />
                <DeskLegend color="bg-warning" label={DESK_DISPLAY_META.held.label} />
                <DeskLegend color="bg-destructive" label={DESK_DISPLAY_META.busy.label} />
              </div>
              {desksLoading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  بارگذاری میزها…
                </div>
              ) : availableDesks.length === 0 ? (
                <p className="py-10 text-center text-[13px] text-muted-foreground">
                  میز فعالی در سامانه ثبت نشده است.
                </p>
              ) : (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {availableDesks.map((d) => {
                    const meta = DESK_DISPLAY_META[d.displayStatus];
                    const isFree = d.displayStatus === "free";
                    return (
                      <button
                        key={d.id}
                        type="button"
                        disabled={!isFree}
                        onClick={() => setSelectedDesk(d)}
                        className={cn(
                          "rounded-xl border p-3 text-right transition",
                          meta.cell,
                          isFree ? "cursor-pointer" : "cursor-not-allowed opacity-85",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13.5px] font-semibold">{d.name}</span>
                          <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", meta.dot)} />
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <span className="text-[11px] text-muted-foreground">{d.zone}</span>
                          <span className="text-[11px] font-medium text-foreground/80">
                            {meta.label}
                          </span>
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground" dir="ltr">
                          {d.code}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
                <div className="text-[11px] font-medium tracking-widest text-muted-foreground">نوع رزرو</div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {types.map((tid) => {
                    const t = typeMeta(pricing, tid);
                    const active = tid === type;
                    return (
                      <button
                        key={tid}
                        type="button"
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

                <div className="mt-6 text-[11px] font-medium tracking-widest text-muted-foreground">
                  {type === "monthly" ? "تاریخ شروع اشتراک" : "تاریخ رزرو"}
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "mt-2 w-full justify-start rounded-xl border-hairline text-right font-normal",
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
                    <div className="mt-2 grid grid-cols-5 gap-1.5 sm:grid-cols-7" dir="ltr">
                      {HOURS.map((h) => {
                        const active = h === startHour;
                        return (
                          <button
                            key={h}
                            type="button"
                            onClick={() => setStartHour(h)}
                            className={cn(
                              "rounded-lg border px-2 py-1.5 text-[12px] transition",
                              active
                                ? "border-primary/60 bg-primary text-primary-foreground"
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

                <div className="mt-6 rounded-xl border border-hairline bg-surface/50 p-4">
                  <div className="flex items-center justify-between text-[12.5px] text-muted-foreground">
                    <span>میز</span>
                    <span className="text-foreground">{selectedDesk.code}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[12.5px] text-muted-foreground">
                    <span>پلن</span>
                    <span className="text-foreground">{current?.label}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[12.5px] text-muted-foreground">
                    <span>{type === "monthly" ? "شروع" : "تاریخ"}</span>
                    <span className="text-foreground">
                      {date ? faJalaliDate(date) : "—"}
                    </span>
                  </div>
                  {type === "hourly" && (
                    <div className="mt-2 flex items-center justify-between text-[12.5px] text-muted-foreground">
                      <span>بازه</span>
                      <span className="text-foreground" dir="ltr">
                        {toFa(startHour)}:۰۰ – {toFa(endHour)}:۰۰
                      </span>
                    </div>
                  )}
                  <div className="my-3 h-px bg-hairline" />
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium">مبلغ قابل پرداخت</span>
                    <span className="text-[15px] font-semibold">{formatToman(total)}</span>
                  </div>
                </div>
              </div>

              <DialogFooter className="flex-row-reverse gap-2 border-t border-hairline bg-surface/40 px-6 py-4">
                <Button onClick={handleConfirm} disabled={confirming} className="rounded-full">
                  {confirming ? (
                    <Loader2 className="ml-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowLeft className="mr-1 h-4 w-4" />
                  )}
                  ثبت رزرو
                </Button>
                <Button variant="ghost" onClick={() => setOpen(false)} className="rounded-full">
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
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="grid h-9 w-9 place-items-center rounded-full border border-hairline bg-card text-muted-foreground transition hover:bg-surface disabled:opacity-40"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <div className="min-w-[6.5rem] rounded-lg border border-hairline bg-background px-4 py-2 text-center text-[14px] font-medium">
          {toFa(value)} {suffix}
        </div>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="grid h-9 w-9 place-items-center rounded-full border border-hairline bg-card text-muted-foreground transition hover:bg-surface disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
