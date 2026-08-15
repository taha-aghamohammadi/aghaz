import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Clock, CalendarDays, CalendarRange, Percent, Sparkles, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { getPricingSettings, updatePricingSettings } from "@/lib/admin.functions";
import {
  faDateTime,
  formatPriceWithCommas,
  parsePriceAmount,
  stripPriceDigits,
  toman,
} from "@/lib/fa-format";
import {
  applyDiscount,
  isDiscountActive,
  unitPriceForType,
  DEFAULT_PRICING,
  type BookingType,
} from "@/lib/booking.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/pricing")({
  head: () => ({
    meta: [
      { title: "تعرفه‌ها | پنل مدیریت آغاز" },
      { name: "description", content: "تعرفه ساعتی، روزانه و ماهانه فضای کار آغاز." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPricing,
});

const TIERS: {
  key: BookingType;
  label: string;
  unit: string;
  icon: typeof Clock;
  tint: string;
}[] = [
  { key: "hourly", label: "ساعتی", unit: "تومان / ساعت", icon: Clock, tint: "from-primary/15" },
  {
    key: "daily",
    label: "روزانه",
    unit: "تومان / روز",
    icon: CalendarDays,
    tint: "from-cyan-500/15",
  },
  {
    key: "monthly",
    label: "ماهانه",
    unit: "تومان / ماه",
    icon: CalendarRange,
    tint: "from-blue-500/15",
  },
];

function parseOptionalPositivePrice(raw: string): number | null {
  if (!raw.trim()) return null;
  const n = parsePriceAmount(raw);
  if (n === null || n < 1) return null;
  return n;
}

function parseOptionalPercent(raw: string): number | null {
  const digits = stripPriceDigits(raw);
  if (!digits) return null;
  const n = Number(digits);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return n;
}

function parseOptionalDurationDays(raw: string): number | null {
  const digits = stripPriceDigits(raw);
  if (!digits) return null;
  const n = Number(digits);
  if (!Number.isFinite(n) || n < 1 || n > 365) return null;
  return n;
}

function AdminPricing() {
  const qc = useQueryClient();
  const fetchPricing = useServerFn(getPricingSettings);
  const savePricing = useServerFn(updatePricingSettings);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin-pricing"],
    queryFn: () => fetchPricing(),
    retry: 1,
  });

  const pricing = data ?? {
    ...DEFAULT_PRICING,
    cardNumber: "",
    cardHolder: "",
    updatedAt: null as string | null,
    source: "defaults" as const,
  };

  const [hourlyRate, setHourlyRate] = useState("");
  const [dailyRate, setDailyRate] = useState("");
  const [monthlyRate, setMonthlyRate] = useState("");
  const [discountPercent, setDiscountPercent] = useState("");
  const [discountDurationDays, setDiscountDurationDays] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardHolder, setCardHolder] = useState("");

  const rateInputs = {
    hourly: hourlyRate,
    daily: dailyRate,
    monthly: monthlyRate,
  };

  const setRate = {
    hourly: setHourlyRate,
    daily: setDailyRate,
    monthly: setMonthlyRate,
  };

  const discountActive = isDiscountActive(pricing);

  const previewDiscountPercent = useMemo(() => {
    if (discountPercent.trim()) {
      const p = parseOptionalPercent(discountPercent);
      if (p !== null) return p;
    }
    return discountActive ? pricing.discountPercent : 0;
  }, [discountPercent, discountActive, pricing.discountPercent]);

  const hasInvalidInput =
    (hourlyRate.length > 0 && !parseOptionalPositivePrice(hourlyRate)) ||
    (dailyRate.length > 0 && !parseOptionalPositivePrice(dailyRate)) ||
    (monthlyRate.length > 0 && !parseOptionalPositivePrice(monthlyRate)) ||
    (discountPercent.length > 0 && parseOptionalPercent(discountPercent) === null) ||
    (discountDurationDays.length > 0 && parseOptionalDurationDays(discountDurationDays) === null);

  const hasAnyInput =
    hourlyRate.trim().length > 0 ||
    dailyRate.trim().length > 0 ||
    monthlyRate.trim().length > 0 ||
    discountPercent.trim().length > 0 ||
    discountDurationDays.trim().length > 0 ||
    cardNumber.trim().length > 0 ||
    cardHolder.trim().length > 0;

  const buildPayload = (): Record<string, number | string> | null => {
    const payload: Record<string, number | string> = {};
    const hourly = parseOptionalPositivePrice(hourlyRate);
    const daily = parseOptionalPositivePrice(dailyRate);
    const monthly = parseOptionalPositivePrice(monthlyRate);
    const discount = parseOptionalPercent(discountPercent);
    const duration = parseOptionalDurationDays(discountDurationDays);

    if (hourlyRate.trim()) {
      if (hourly === null) return null;
      payload.hourlyRate = hourly;
    }
    if (dailyRate.trim()) {
      if (daily === null) return null;
      payload.dailyRate = daily;
    }
    if (monthlyRate.trim()) {
      if (monthly === null) return null;
      payload.monthlyRate = monthly;
    }
    if (discountPercent.trim()) {
      if (discount === null) return null;
      payload.discountPercent = discount;
      if (discount > 0 && !discountDurationDays.trim()) {
        toast.error("برای فعال‌کردن تخفیف، مدت (روز) را هم وارد کنید.");
        return null;
      }
    }
    if (discountDurationDays.trim()) {
      if (duration === null) return null;
      payload.discountDurationDays = duration;
    }
    if (cardNumber.trim()) payload.cardNumber = cardNumber.trim();
    if (cardHolder.trim()) payload.cardHolder = cardHolder.trim();

    if (Object.keys(payload).length === 0) {
      toast.error("حداقل یک فیلد برای به‌روزرسانی وارد کنید.");
      return null;
    }
    return payload;
  };

  const save = useMutation({
    mutationFn: (payload: Record<string, number | string>) => savePricing({ data: payload }),
    onSuccess: () => {
      toast.success("تعرفه‌ها ذخیره شد");
      setHourlyRate("");
      setDailyRate("");
      setMonthlyRate("");
      setDiscountPercent("");
      setDiscountDurationDays("");
      setCardNumber("");
      setCardHolder("");
      void qc.invalidateQueries({ queryKey: ["admin-pricing"] });
      void qc.invalidateQueries({ queryKey: ["public-pricing"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-[15px] font-semibold">تعرفه‌ها و تخفیف</h2>
          <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-muted-foreground">
            تعرفه‌های سراسری برای همه میزها. فقط فیلدهایی که می‌خواهید تغییر کنند را پر کنید.
          </p>
        </div>
        {pricing.updatedAt && (
          <Badge variant="secondary" className="shrink-0 rounded-full text-[11px] font-normal">
            آخرین به‌روزرسانی: {faDateTime(pricing.updatedAt)}
          </Badge>
        )}
      </div>

      {(isError || pricing.source === "defaults") && (
        <div
          className={cn(
            "rounded-xl border px-4 py-3 text-[12px]",
            isError
              ? "border-destructive/40 bg-destructive/5 text-destructive"
              : "border-hairline bg-surface/50 text-muted-foreground",
          )}
        >
          {isError && (
            <span>
              خواندن از دیتابیس ناموفق بود.
              {error instanceof Error ? ` ${error.message}` : ""}
            </span>
          )}
          {pricing.source === "defaults" && !isError && (
            <span>ردیف تعرفه در دیتابیس پیدا نشد — مقادیر پیش‌فرض نمایش داده می‌شود.</span>
          )}
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-[28rem] rounded-2xl" />
      ) : (
        <div className="rounded-2xl border border-hairline bg-card">
          <div className="border-b border-hairline px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-medium">پلن‌های اشتراک</span>
              {discountActive && (
                <Badge className="rounded-full bg-primary/10 text-primary hover:bg-primary/15">
                  <Sparkles className="ml-1 h-3 w-3" />
                  تخفیف {pricing.discountPercent}٪ فعال
                </Badge>
              )}
              {!discountActive && pricing.discountPercent > 0 && pricing.discountEndsAt && (
                <Badge variant="secondary" className="rounded-full text-[11px]">
                  تخفیف منقضی شده
                </Badge>
              )}
            </div>
            {discountActive && pricing.discountEndsAt && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                تا {faDateTime(pricing.discountEndsAt)}
              </p>
            )}
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-3 sm:p-6">
            {TIERS.map((tier) => {
              const current = unitPriceForType(pricing, tier.key);
              const base =
                tier.key === "hourly"
                  ? pricing.hourlyRate
                  : tier.key === "daily"
                    ? pricing.dailyRate
                    : pricing.monthlyRate;
              const effective =
                previewDiscountPercent > 0 ? applyDiscount(base, previewDiscountPercent) : current;
              const input = rateInputs[tier.key];
              const invalid = input.length > 0 && !parseOptionalPositivePrice(input);
              const Icon = tier.icon;

              return (
                <div
                  key={tier.key}
                  className="overflow-hidden rounded-xl border border-hairline bg-background"
                >
                  <div className={cn("h-1.5 bg-gradient-to-r to-transparent", tier.tint)} />
                  <div className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Icon className="h-4 w-4" />
                      <span className="text-[12px] font-medium">{tier.label}</span>
                    </div>

                    <div className="mt-3">
                      <div className="text-[11px] text-muted-foreground">قیمت فعلی</div>
                      <div className="mt-0.5 text-[17px] font-semibold tracking-tight">
                        {toman(base)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{tier.unit}</div>
                    </div>

                    {previewDiscountPercent > 0 && effective < base && (
                      <div className="mt-3 rounded-lg bg-primary/5 px-3 py-2">
                        <div className="text-[10px] text-primary">
                          با تخفیف {previewDiscountPercent}٪
                        </div>
                        <div className="text-[14px] font-semibold text-primary">
                          {toman(effective)}
                        </div>
                      </div>
                    )}

                    <div className="mt-4 space-y-1.5">
                      <Label className="text-[11px] text-muted-foreground">
                        مقدار جدید (اختیاری)
                      </Label>
                      <Input
                        value={input}
                        onChange={(e) =>
                          setRate[tier.key](formatPriceWithCommas(stripPriceDigits(e.target.value)))
                        }
                        dir="ltr"
                        inputMode="numeric"
                        placeholder="بدون تغییر"
                        className={cn(invalid && "border-destructive")}
                        aria-invalid={invalid}
                      />
                      {invalid && (
                        <p className="text-[10px] text-destructive">عدد بیشتر از صفر وارد کنید.</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-hairline bg-surface/30 px-5 py-5 sm:px-6">
            <div className="flex items-center gap-2 text-[12px] font-medium text-muted-foreground">
              <Percent className="h-4 w-4" />
              تخفیف سراسری
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              روی هر سه پلن اعمال می‌شود. برای حذف تخفیف، درصد را ۰ وارد کنید.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">
                  درصد تخفیف
                  {pricing.discountPercent > 0 && (
                    <span className="text-foreground/70"> · فعلی {pricing.discountPercent}٪</span>
                  )}
                </Label>
                <Input
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(stripPriceDigits(e.target.value).slice(0, 3))}
                  dir="ltr"
                  inputMode="numeric"
                  placeholder="مثلاً ۱۰"
                  className={cn(
                    discountPercent.length > 0 &&
                      parseOptionalPercent(discountPercent) === null &&
                      "border-destructive",
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">
                  مدت (روز)
                  {pricing.discountEndsAt && (
                    <span className="text-foreground/70">
                      · پایان {faDateTime(pricing.discountEndsAt)}
                    </span>
                  )}
                </Label>
                <Input
                  value={discountDurationDays}
                  onChange={(e) =>
                    setDiscountDurationDays(stripPriceDigits(e.target.value).slice(0, 3))
                  }
                  dir="ltr"
                  inputMode="numeric"
                  placeholder="مثلاً ۱۴"
                  className={cn(
                    discountDurationDays.length > 0 &&
                      parseOptionalDurationDays(discountDurationDays) === null &&
                      "border-destructive",
                  )}
                />
              </div>
            </div>
          </div>

          <div className="border-t border-hairline bg-surface/30 px-5 py-5 sm:px-6">
            <div className="flex items-center gap-2 text-[12px] font-medium text-muted-foreground">
              <CreditCard className="h-4 w-4" />
              پرداخت کارت به کارت
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              شماره کارتی که کاربران برای پرداخت رزرو به آن واریز می‌کنند. در صفحه کاربر نمایش داده
              می‌شود.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">
                  شماره کارت
                  {pricing.cardNumber && (
                    <span className="text-foreground/70"> · فعلی {pricing.cardNumber}</span>
                  )}
                </Label>
                <Input
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, "").slice(0, 16))}
                  dir="ltr"
                  inputMode="numeric"
                  placeholder="مثلاً ۵۸۷4…"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">
                  نام صاحب کارت
                  {pricing.cardHolder && (
                    <span className="text-foreground/70"> · فعلی {pricing.cardHolder}</span>
                  )}
                </Label>
                <Input
                  value={cardHolder}
                  onChange={(e) => setCardHolder(e.target.value)}
                  dir="rtl"
                  placeholder="مثلاً علی محمدی"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-hairline px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-[11px] text-muted-foreground">فیلدهای خالی بدون تغییر می‌مانند.</p>
            <Button
              className="rounded-full sm:min-w-[9rem]"
              disabled={save.isPending || !hasAnyInput || hasInvalidInput}
              onClick={() => {
                const payload = buildPayload();
                if (payload) save.mutate(payload);
              }}
            >
              {save.isPending ? "در حال ذخیره…" : "ذخیره تغییرات"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
