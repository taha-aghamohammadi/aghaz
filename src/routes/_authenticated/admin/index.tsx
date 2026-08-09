import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, CalendarCheck, LayoutGrid, TrendingUp, Users, Wallet } from "lucide-react";
import { getAdminOverview } from "@/lib/admin.functions";
import {
  BOOKING_STATUS_LABEL,
  BOOKING_TYPE_LABEL,
  faDate,
  faNumber,
  toman,
  tomanShort,
} from "@/lib/fa-format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "داشبورد مدیریت | آغاز" },
      { name: "description", content: "نمای کلی رزروها، درآمد و وضعیت میزهای فضای کار اشتراکی آغاز." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "داشبورد مدیریت | آغاز" },
      { property: "og:description", content: "نمای کلی رزروها، درآمد و وضعیت میزهای آغاز." },
    ],
  }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const fetchOverview = useServerFn(getAdminOverview);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => fetchOverview(),
  });

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
    );
  }

  const t = data.totals;
  const occupancy = t.desks ? Math.round((t.busyDesks / t.desks) * 100) : 0;

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={CalendarCheck} label="کل رزروهای فعال" value={faNumber(t.bookings)} hint={`${faNumber(t.pending)} در انتظار تأیید`} />
        <Stat icon={TrendingUp} label="درآمد پرداخت‌شده" value={tomanShort(t.revenue)} hint={`این ماه ${tomanShort(t.monthRevenue)}`} />
        <Stat icon={Users} label="کاربران ثبت‌نام‌شده" value={faNumber(t.users)} hint={`${faNumber(t.unpaid)} رزرو پرداخت‌نشده`} />
        <Stat icon={LayoutGrid} label="اشغال میزها" value={`${faNumber(occupancy)}٪`} hint={`${faNumber(t.busyDesks)} از ${faNumber(t.desks)} میز`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-hairline p-5 lg:col-span-1">
          <div className="text-[11px] tracking-widest text-muted-foreground">ترکیب رزروها</div>
          <div className="mt-4 space-y-3">
            {(["hourly", "daily", "monthly"] as const).map((k) => {
              const total = data.byType.hourly + data.byType.daily + data.byType.monthly || 1;
              const pct = Math.round((data.byType[k] / total) * 100);
              return (
                <div key={k}>
                  <div className="flex items-center justify-between text-[12.5px]">
                    <span className="text-muted-foreground">{BOOKING_TYPE_LABEL[k]}</span>
                    <span>{faNumber(data.byType[k])} رزرو</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-hairline p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="text-[11px] tracking-widest text-muted-foreground">خلاصه مالی این ماه</div>
            <Button asChild variant="ghost" size="sm" className="rounded-full text-[12.5px]">
              <Link to="/admin/finance">
                حسابداری
                <ArrowLeft className="mr-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <MiniStat label="درآمد ثبت‌شده" value={toman(data.finance.income)} />
            <MiniStat label="هزینه‌ها" value={toman(data.finance.expense)} />
            <MiniStat label="سود خالص" value={toman(data.finance.net)} accent />
          </div>
          <div className="mt-5 flex items-center gap-2 rounded-xl border border-hairline bg-surface/50 p-3 text-[12px] text-muted-foreground">
            <Wallet className="h-4 w-4 shrink-0" />
            درآمد رزروهای پرداخت‌شده به‌صورت خودکار در داشبورد محاسبه می‌شود؛ هزینه‌ها را در بخش
            حسابداری ثبت کنید.
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-hairline">
        <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
          <div className="text-[13px] font-medium">آخرین رزروها</div>
          <Button asChild variant="ghost" size="sm" className="rounded-full text-[12.5px]">
            <Link to="/admin/bookings">
              همه رزروها
              <ArrowLeft className="mr-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
        {data.recent.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-muted-foreground">
            هنوز رزروی ثبت نشده است.
          </p>
        ) : (
          <ul className="divide-y divide-hairline">
            {data.recent.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[12.5px]" dir="ltr">
                      {b.code}
                    </span>
                    <span className="text-[12.5px] text-muted-foreground">
                      {b.full_name || "مهمان"}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                    {BOOKING_TYPE_LABEL[b.booking_type] ?? b.booking_type} · {faDate(b.start_at)} ·{" "}
                    {BOOKING_STATUS_LABEL[b.status] ?? b.status}
                  </div>
                </div>
                <span className="text-[13px] font-medium">{toman(b.total_amount ?? 0)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof CalendarCheck;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-hairline p-5">
      <div className="flex items-center justify-between">
        <span className="text-[11.5px] text-muted-foreground">{label}</span>
        <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-3 text-[20px] font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-[11.5px] text-muted-foreground">{hint}</div>
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-hairline bg-surface/40 p-4">
      <div className="text-[11.5px] text-muted-foreground">{label}</div>
      <div className={`mt-1.5 text-[15px] font-semibold ${accent ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}
