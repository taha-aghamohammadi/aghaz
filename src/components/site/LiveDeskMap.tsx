import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, MapPin } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useBooking } from "@/components/site/BookingDialog";
import { listPublicDesks, type PublicDesk } from "@/lib/booking.functions";
import { DEFAULT_PRICING, unitPriceForType, type PricingTiers } from "@/lib/booking.service";
import { toman, toFa } from "@/lib/fa-format";

import { DESK_DISPLAY_META } from "@/components/site/desk-display-meta";

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${color}`} /> {label}
    </span>
  );
}

export function LiveDeskMap() {
  const { open } = useBooking();
  const fetchDesks = useServerFn(listPublicDesks);
  const [desks, setDesks] = useState<PublicDesk[]>([]);
  const [pricing, setPricing] = useState<PricingTiers>(DEFAULT_PRICING);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PublicDesk | null>(null);

  useEffect(() => {
    let active = true;
    void fetchDesks({ data: {} })
      .then((res) => {
        if (active) {
          setDesks(res.desks);
          setPricing(res.pricing);
        }
      })
      .catch(() => {
        if (active) setDesks([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchDesks]);

  const free = desks.filter((d) => d.displayStatus === "free").length;
  const meta = selected ? DESK_DISPLAY_META[selected.displayStatus] : null;

  return (
    <section className="border-b border-hairline bg-surface/40 py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-10 md:grid-cols-[0.85fr_1.15fr] md:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-hairline bg-background px-3 py-1 text-[11px] text-muted-foreground">
              <span className="inline-flex h-1.5 w-1.5 animate-pulse-dot rounded-full bg-success" />
              ظرفیت لحظه‌ای
            </div>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">ببین چی خالیه، همین الان.</h2>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted-foreground">
              نقشه‌ی میزهای اشتراکی آغاز از داده‌ی واقعی سامانه به‌روز می‌شود. روی هر میز بزن و رزرو کن.
            </p>
            <div className="mt-6 flex items-baseline gap-2">
              <span className="text-5xl font-semibold tracking-tight">{toFa(free)}</span>
              <span className="text-[13px] text-muted-foreground">
                میز آزاد از {toFa(desks.length)} میز
              </span>
            </div>
            <div className="mt-6 flex flex-wrap gap-4 text-[12px] text-muted-foreground">
              <Legend color="bg-success" label="آزاد" />
              <Legend color="bg-warning" label="رزرو شده" />
              <Legend color="bg-destructive" label="پر" />
            </div>
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

            <div className="bg-[radial-gradient(circle_at_1px_1px,color-mix(in_oklab,var(--foreground)_10%,transparent)_1px,transparent_0)] [background-size:22px_22px] p-4 sm:p-6">
              {loading ? (
                <p className="py-8 text-center text-[13px] text-muted-foreground">بارگذاری نقشه…</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {desks.map((d) => {
                    const deskMeta = DESK_DISPLAY_META[d.displayStatus];
                    const isFree = d.displayStatus === "free";
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setSelected(d)}
                        className={`group cursor-pointer rounded-2xl border p-3 text-right transition ${deskMeta.cell} ${
                          isFree ? "" : "opacity-80"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13.5px] font-semibold">{d.name}</span>
                          <span className={`h-2 w-2 shrink-0 rounded-full ${deskMeta.dot}`} />
                        </div>
                        <div className="mt-1 truncate text-[11px] text-muted-foreground">{d.zone}</div>
                        <div className="mt-3 text-[11px] text-foreground/70">
                          {isFree ? "مشاهده و رزرو" : deskMeta.label}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-md rounded-3xl">
          {selected && meta && (
            <>
              <DialogHeader className="text-right">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                  <span className="text-[11px] text-muted-foreground">{meta.label}</span>
                </div>
                <DialogTitle className="text-2xl font-semibold tracking-tight">
                  {selected.name} · {selected.zone}
                </DialogTitle>
                <DialogDescription className="text-[13px] leading-relaxed">
                  {selected.locationNote || "میز اشتراکی آغاز"}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="rounded-2xl border border-hairline bg-surface/50 p-4">
                  <div className="flex items-center gap-2 text-[12px] font-medium text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    کد میز
                  </div>
                  <div className="mt-1.5 text-[14px]" dir="ltr">{selected.code}</div>
                </div>

                {selected.features.length > 0 && (
                  <div className="rounded-2xl border border-hairline p-4">
                    <div className="text-[12px] font-medium text-muted-foreground">ویژگی‌ها</div>
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                      {selected.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-[13px]">
                          <Check className="h-3.5 w-3.5 shrink-0 text-success" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 rounded-2xl border border-hairline bg-surface/50 px-4 py-3">
                  <span className="text-[12px] text-muted-foreground">تعرفه ساعتی</span>
                  <span className="text-[14px] font-semibold">{toman(unitPriceForType(pricing, "hourly"))}</span>
                </div>

                <Button
                  className="w-full rounded-full"
                  disabled={selected.displayStatus !== "free"}
                  onClick={() => {
                    setSelected(null);
                    open({ type: "hourly", desk: selected });
                  }}
                >
                  {selected.displayStatus === "free" ? "رزرو این میز" : "این میز فعلاً در دسترس نیست"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
