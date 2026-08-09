import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { faIR } from "date-fns/locale";
import {
  CalendarDays,
  Download,
  Loader2,
  LogOut,
  Plus,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { cancelMyBooking, listMyBookings } from "@/lib/booking.functions";
import {
  BOOKING_STATUS_LABEL,
  BOOKING_TYPE_LABEL,
  faDateTime,
  PAYMENT_STATUS_LABEL,
  toman,
} from "@/lib/fa-format";
import { buildReceiptHtml, type Receipt } from "@/components/site/receipt-document";
import logo from "@/assets/aghaz-logo.png.asset.json";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "داشبورد | آغاز" },
      {
        name: "description",
        content: "رزروهای فعال و تاریخچه میزهای اشتراکی شما در آغاز.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

function toReceipt(booking: {
  code: string;
  desk_code: string;
  booking_type: string;
  start_at: string;
  end_at: string;
  units: number;
  unit_price: number;
  total_amount: number;
  payment_status: string;
}, customerName: string): Receipt {
  const type = booking.booking_type as "hourly" | "daily" | "monthly";
  const unit =
    type === "hourly" ? "ساعت" : type === "daily" ? "روز" : "ماه";
  const dateLabel = format(new Date(booking.start_at), "d MMMM yyyy", { locale: faIR });
  return {
    code: booking.code,
    customerName,
    planLabel: BOOKING_TYPE_LABEL[type] ?? type,
    dateLabel,
    details: faDateTime(booking.start_at),
    timeRange: type === "hourly" ? faDateTime(booking.end_at) : null,
    quantity: `${booking.units} ${unit}`,
    unitPrice: booking.unit_price,
    unit,
    total: booking.total_amount,
    issuedAt: format(new Date(), "d MMMM yyyy · HH:mm", { locale: faIR }),
    qrDataUrl: "",
    deskCode: booking.desk_code,
    paymentStatusLabel: PAYMENT_STATUS_LABEL[booking.payment_status] ?? booking.payment_status,
  };
}

function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchBookings = useServerFn(listMyBookings);
  const cancelBooking = useServerFn(cancelMyBooking);

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userData.user.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["my-bookings"],
    queryFn: () => fetchBookings(),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => cancelBooking({ data: { id } }),
    onSuccess: () => {
      toast.success("رزرو لغو شد.");
      void queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "لغو رزرو ناموفق بود."),
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const now = new Date();
  const upcoming = bookings.filter(
    (b) => b.status !== "cancelled" && new Date(b.end_at) >= now,
  );
  const past = bookings.filter(
    (b) => b.status === "cancelled" || new Date(b.end_at) < now,
  );
  const customerName = profile?.full_name ?? "مهمان";

  const downloadReceipt = (booking: typeof bookings[number]) => {
    const receipt = toReceipt(booking, customerName);
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;left:-9999px;top:0;width:794px;height:1123px;border:0";
    document.body.appendChild(frame);
    const doc = frame.contentDocument!;
    doc.open();
    doc.write(
      buildReceiptHtml(receipt, (v) =>
        v >= 1_000_000
          ? `${(v / 1_000_000).toFixed(1)} میلیون تومان`
          : `${v.toLocaleString("en-US")} تومان`,
      ),
    );
    doc.close();
    setTimeout(() => {
      frame.contentWindow?.print();
      setTimeout(() => frame.remove(), 500);
    }, 300);
  };

  return (
    <div className="min-h-screen bg-surface">
      <Toaster position="top-center" />
      <header className="border-b border-hairline bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo.url} alt="لوگوی آغاز" className="h-8 w-8 object-contain" />
            <span className="text-[15px] font-semibold tracking-tight">آغاز</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="text-[13px]">
              <Link to="/account">حساب من</Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void signOut()} className="text-[13px]">
              <LogOut className="ml-1.5 h-4 w-4" />
              خروج
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">داشبورد</h1>
            <p className="mt-2 text-[13.5px] text-muted-foreground">
              رزروهای فعال و تاریخچه میزهای اشتراکی شما.
            </p>
          </div>
          <Button asChild className="rounded-full">
            <Link to="/">
              <Plus className="ml-1.5 h-4 w-4" />
              رزرو جدید
            </Link>
          </Button>
        </div>

        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold">
            <CalendarDays className="h-4 w-4 text-primary" />
            رزروهای فعال
          </h2>
          {isLoading ? (
            <p className="mt-4 text-[13px] text-muted-foreground">در حال بارگذاری…</p>
          ) : upcoming.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-hairline bg-background p-8 text-center">
              <p className="text-[13.5px] text-muted-foreground">رزرو فعالی ندارید.</p>
              <Button asChild className="mt-4 rounded-full" size="sm">
                <Link to="/">رزرو میز</Link>
              </Button>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {upcoming.map((b) => (
                <li
                  key={b.id}
                  className="rounded-2xl border border-hairline bg-background p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-mono text-[14px] font-semibold" dir="ltr">{b.code}</div>
                      <div className="mt-1 text-[13px] text-muted-foreground">
                        میز {b.desk_code} · {BOOKING_TYPE_LABEL[b.booking_type] ?? b.booking_type}
                      </div>
                      <div className="mt-2 text-[12.5px] text-muted-foreground">
                        {faDateTime(b.start_at)} — {faDateTime(b.end_at)}
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="text-[15px] font-semibold">{toman(b.total_amount)}</div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge variant="outline">{BOOKING_STATUS_LABEL[b.status] ?? b.status}</Badge>
                        <Badge variant="secondary">
                          {PAYMENT_STATUS_LABEL[b.payment_status] ?? b.payment_status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full border-hairline"
                      onClick={() => downloadReceipt(b)}
                    >
                      <Download className="ml-1.5 h-3.5 w-3.5" />
                      رسید
                    </Button>
                    {b.payment_status !== "paid" && b.status !== "cancelled" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-full text-destructive"
                        disabled={cancel.isPending}
                        onClick={() => cancel.mutate(b.id)}
                      >
                        {cancel.isPending ? (
                          <Loader2 className="ml-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <XCircle className="ml-1.5 h-3.5 w-3.5" />
                        )}
                        لغو رزرو
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {past.length > 0 && (
          <section className="mt-10">
            <h2 className="text-[15px] font-semibold text-muted-foreground">تاریخچه</h2>
            <ul className="mt-4 space-y-2">
              {past.slice(0, 10).map((b) => (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-hairline bg-background/60 px-4 py-3 text-[13px]"
                >
                  <span className="font-mono" dir="ltr">{b.code}</span>
                  <span className="text-muted-foreground">{faDateTime(b.start_at)}</span>
                  <span>{BOOKING_STATUS_LABEL[b.status] ?? b.status}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-10 text-center text-[12px] text-muted-foreground">
          درب هوشمند و پرداخت آنلاین به‌زودی در این داشبورد فعال می‌شود.
        </p>
      </main>
    </div>
  );
}
