import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Briefcase,
  CalendarDays,
  GraduationCap,
  IdCard,
  Loader2,
  LogOut,
  Pencil,
  Phone,
  User,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { updateMyProfile } from "@/lib/auth.functions";
import { normalizeNationalId } from "@/lib/national-id";
import { cancelMyBooking } from "@/lib/booking.functions";
import { listMyBookings } from "@/lib/booking.functions";
import { createBookingPayment } from "@/lib/payment.functions";
import { getWalletBalance, payBookingFromWallet } from "@/lib/wallet.functions";
import {
  BOOKING_STATUS_LABEL,
  BOOKING_TYPE_LABEL,
  PAYMENT_STATUS_LABEL,
  faDateTime,
  toman,
} from "@/lib/fa-format";
import { logo } from "@/lib/site-assets";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "حساب من | آغاز" },
      {
        name: "description",
        content: "پروفایل و اطلاعات حساب کاربری شما در آغاز.",
      },
      { property: "og:title", content: "حساب من | آغاز" },
      { property: "og:description", content: "پروفایل و اطلاعات حساب کاربری شما در آغاز." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AccountPage,
  errorComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <p className="text-sm text-muted-foreground">بارگذاری حساب ممکن نشد. صفحه را دوباره باز کنید.</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center px-6">
      <p className="text-sm text-muted-foreground">صفحه پیدا نشد.</p>
    </div>
  ),
});

const toFa = (v: string) => v.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]!);

const EDUCATION_OPTIONS = ["دیپلم", "کاردانی", "کارشناسی", "کارشناسی ارشد", "دکتری", "سایر"];

function AccountPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchMyBookings = useServerFn(listMyBookings);
  const cancelBooking = useServerFn(cancelMyBooking);
  const startPayment = useServerFn(createBookingPayment);
  const walletPay = useServerFn(payBookingFromWallet);
  const fetchWallet = useServerFn(getWalletBalance);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    nationalId: "",
    jobTitle: "",
    education: "",
  });

  const { data: wallet } = useQuery({
    queryKey: ["wallet-balance"],
    queryFn: () => fetchWallet(),
  });

  const payOnline = useMutation({
    mutationFn: (bookingId: string) => startPayment({ data: { bookingId } }),
    onSuccess: (res) => {
      if (res.paymentUrl) window.location.href = res.paymentUrl;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const payWallet = useMutation({
    mutationFn: (bookingId: string) => walletPay({ data: { bookingId } }),
    onSuccess: () => {
      toast.success("پرداخت از کیف پول انجام شد");
      void queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      void queryClient.invalidateQueries({ queryKey: ["wallet-balance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: bookings, isLoading: bookingsLoading } = useQuery({
    queryKey: ["my-bookings"],
    queryFn: () => fetchMyBookings(),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => cancelBooking({ data: { id } }),
    onSuccess: () => {
      toast.success("رزرو لغو شد");
      void queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, phone, national_id, job_title, education, created_at")
        .eq("id", userData.user.id)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (!profile) return;
    setForm({
      fullName: profile.full_name ?? "",
      nationalId: profile.national_id ?? "",
      jobTitle: profile.job_title ?? "",
      education: profile.education ?? "",
    });
  }, [profile]);

  const save = useMutation({
    mutationFn: async () => updateMyProfile({ data: form }),
    onSuccess: async () => {
      toast.success("اطلاعات شما ذخیره شد.");
      setEditing(false);
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "ذخیره اطلاعات ناموفق بود."),
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const localPhone = profile?.phone ? profile.phone.replace("+98", "0") : "";

  const rows = [
    { icon: User, label: "نام و نام خانوادگی", value: profile?.full_name || "—" },
    {
      icon: IdCard,
      label: "کد ملی",
      value: profile?.national_id ? toFa(profile.national_id) : "—",
      ltr: true,
    },
    { icon: Briefcase, label: "شغل", value: profile?.job_title || "—" },
    { icon: GraduationCap, label: "تحصیلات", value: profile?.education || "—" },
    { icon: Phone, label: "شماره تماس", value: localPhone ? toFa(localPhone) : "—", ltr: true },
    {
      icon: CalendarDays,
      label: "تاریخ عضویت",
      value: profile?.created_at
        ? toFa(new Date(profile.created_at).toLocaleDateString("fa-IR"))
        : "—",
    },
  ];

  return (
    <div className="min-h-screen bg-surface">
      <Toaster position="top-center" />
      <header className="border-b border-hairline bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo.url} alt="لوگوی آغاز" className="h-8 w-8 object-contain" />
            <span className="text-[15px] font-semibold tracking-tight">آغاز</span>
          </Link>
          <Button variant="ghost" size="sm" onClick={() => void signOut()} className="text-[13px]">
            <LogOut className="ml-1.5 h-4 w-4" />
            خروج
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">حساب من</h1>
            <p className="mt-2 text-[13.5px] text-muted-foreground">
              اطلاعات حساب شما برای رزرو میزهای اشتراکی.
            </p>
          </div>
          {!editing && !isLoading && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-full text-[13px]"
              onClick={() => setEditing(true)}
            >
              <Pencil className="ml-1.5 h-3.5 w-3.5" />
              ویرایش اطلاعات
            </Button>
          )}
        </div>

        <div className="mt-8 rounded-2xl border border-hairline bg-background p-6">
          {isLoading ? (
            <p className="text-[13.5px] text-muted-foreground">در حال بارگذاری…</p>
          ) : editing ? (
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                if (form.fullName.trim().length < 3) {
                  toast.error("نام و نام خانوادگی را کامل وارد کنید.");
                  return;
                }
                if (form.nationalId && !normalizeNationalId(form.nationalId)) {
                  toast.error("کد ملی معتبر نیست.", {
                    description: "باید ۱۰ رقم باشد و رقم کنترل (آخر) درست باشد.",
                  });
                  return;
                }
                save.mutate();
              }}
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-[13px]">
                    نام و نام خانوادگی
                  </Label>
                  <Input
                    id="fullName"
                    value={form.fullName}
                    maxLength={80}
                    onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                    className="h-11 text-[14px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nationalId" className="text-[13px]">
                    کد ملی
                  </Label>
                  <Input
                    id="nationalId"
                    dir="ltr"
                    inputMode="numeric"
                    maxLength={10}
                    value={form.nationalId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, nationalId: e.target.value.replace(/\D/g, "") }))
                    }
                    placeholder="0123456789"
                    className="h-11 text-left text-[14px] tracking-wide"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="jobTitle" className="text-[13px]">
                    شغل
                  </Label>
                  <Input
                    id="jobTitle"
                    value={form.jobTitle}
                    maxLength={80}
                    onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))}
                    placeholder="مثلاً طراح محصول"
                    className="h-11 text-[14px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="education" className="text-[13px]">
                    تحصیلات
                  </Label>
                  <select
                    id="education"
                    value={form.education}
                    onChange={(e) => setForm((f) => ({ ...f, education: e.target.value }))}
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-[14px] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <option value="">انتخاب کنید</option>
                    {EDUCATION_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="text-[12px] text-muted-foreground">
                شماره تماس شما قابل تغییر نیست، چون حساب با آن ساخته شده است.
              </p>

              <div className="flex flex-wrap gap-3">
                <Button
                  type="submit"
                  disabled={save.isPending}
                  className="rounded-full text-[13.5px]"
                >
                  {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "ذخیره تغییرات"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-full text-[13.5px]"
                  onClick={() => {
                    setEditing(false);
                    if (profile)
                      setForm({
                        fullName: profile.full_name ?? "",
                        nationalId: profile.national_id ?? "",
                        jobTitle: profile.job_title ?? "",
                        education: profile.education ?? "",
                      });
                  }}
                >
                  انصراف
                </Button>
              </div>
            </form>
          ) : (
            <dl className="divide-y divide-hairline">
              {rows.map((row, i) => (
                <div
                  key={row.label}
                  className={`flex items-center gap-4 ${i === 0 ? "pb-4" : i === rows.length - 1 ? "pt-4" : "py-4"}`}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted-foreground">
                    <row.icon className="h-4.5 w-4.5" />
                  </span>
                  <div>
                    <dt className="text-[12px] text-muted-foreground">{row.label}</dt>
                    <dd
                      dir={row.ltr ? "ltr" : undefined}
                      className="text-[14.5px] font-medium"
                    >
                      {row.value}
                    </dd>
                  </div>
                </div>
              ))}
            </dl>
          )}
        </div>

        <div className="mt-8 rounded-2xl border border-hairline bg-background p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight">رزروهای من</h2>
            {wallet && (
              <span className="text-[13px] text-muted-foreground">
                کیف پول: {toman(wallet.balance)}
              </span>
            )}
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">
            رزروهای فعال و گذشته‌ی میزهای اشتراکی.
          </p>

          {bookingsLoading ? (
            <p className="mt-6 text-[13px] text-muted-foreground">در حال بارگذاری…</p>
          ) : !bookings || bookings.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-hairline px-4 py-10 text-center text-[13px] text-muted-foreground">
              هنوز رزروی ثبت نکرده‌اید.
              <div className="mt-4">
                <Button asChild variant="outline" className="rounded-full">
                  <Link to="/">مشاهده میزهای آزاد</Link>
                </Button>
              </div>
            </div>
          ) : (
            <ul className="mt-6 divide-y divide-hairline">
              {bookings.map((b) => (
                <li key={b.id} className="flex flex-wrap items-start justify-between gap-4 py-4 first:pt-0">
                  <div className="min-w-0">
                    <div className="font-mono text-[13px] font-semibold" dir="ltr">{b.code}</div>
                    <div className="mt-1 text-[13px]">
                      میز {b.desk_code} · {BOOKING_TYPE_LABEL[b.booking_type] ?? b.booking_type}
                    </div>
                    <div className="mt-1 text-[12px] text-muted-foreground">
                      {faDateTime(b.start_at)} — {faDateTime(b.end_at)}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="secondary" className="rounded-full text-[11px]">
                        {BOOKING_STATUS_LABEL[b.status] ?? b.status}
                      </Badge>
                      <Badge variant="outline" className="rounded-full text-[11px]">
                        {PAYMENT_STATUS_LABEL[b.payment_status] ?? b.payment_status}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-[14px] font-semibold">{toman(b.total_amount ?? 0)}</span>
                    {b.payment_status !== "paid" && b.status !== "cancelled" && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-full"
                          disabled={payOnline.isPending}
                          onClick={() => payOnline.mutate(b.id)}
                        >
                          پرداخت آنلاین
                        </Button>
                        {wallet && wallet.balance >= (b.total_amount ?? 0) && (
                          <Button
                            size="sm"
                            className="h-8 rounded-full"
                            disabled={payWallet.isPending}
                            onClick={() => payWallet.mutate(b.id)}
                          >
                            پرداخت از کیف پول
                          </Button>
                        )}
                      </div>
                    )}
                    {b.status === "pending" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-full text-destructive"
                        disabled={cancel.isPending}
                        onClick={() => cancel.mutate(b.id)}
                      >
                        <XCircle className="ml-1 h-3.5 w-3.5" />
                        لغو
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild className="rounded-full">
            <Link to="/">رزرو میز</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
