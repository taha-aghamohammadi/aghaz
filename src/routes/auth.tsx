import { createFileRoute, Link, useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Briefcase,
  Check,
  IdCard,
  KeyRound,
  Loader2,
  Phone,
  ShieldCheck,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { requestPhoneOtp, updateMyProfile, verifyPhoneOtp } from "@/lib/auth.functions";
import { OtpDemoBadge } from "@/components/site/OtpDemoBadge";
import { isOtpDemoMode } from "@/lib/demo-mode";
import { normalizeNationalId } from "@/lib/national-id";
import { logo } from "@/lib/site-assets";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : "/",
  }),
  head: () => ({
    meta: [
      { title: "ورود و ثبت‌نام | آغاز" },
      {
        name: "description",
        content:
          "با شماره موبایل وارد حساب آغاز شوید یا ثبت‌نام کنید و میز اشتراکی خود را رزرو کنید.",
      },
      { property: "og:title", content: "ورود و ثبت‌نام | آغاز" },
      {
        property: "og:description",
        content: "ورود سریع با شماره موبایل و کد یکبار مصرف — بدون رمز عبور.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

const toFa = (v: string | number) => String(v).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]!);

type Step = "phone" | "otp" | "signup";

const perks = [
  "رزرو ساعتی، روزانه و ماهانه میز اشتراکی",
  "دسترسی به تاریخچه رزروها و رسیدها",
  "ورود بدون رمز عبور با کد یکبار مصرف",
];

const EDUCATION_OPTIONS = [
  "دیپلم",
  "کاردانی",
  "کارشناسی",
  "کارشناسی ارشد",
  "دکتری",
  "سایر",
];

function AuthPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const { redirect } = useSearch({ from: "/auth" });
  const [step, setStep] = useState<Step>("phone");
  const [fullName, setFullName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [education, setEducation] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  const afterAuthPath = redirect || "/";

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: afterAuthPath, replace: true });
    });
  }, [navigate, afterAuthPath]);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  function resetToPhone() {
    setStep("phone");
    setCode("");
    setDemoCode(null);
    setSeconds(0);
  }

  async function sendCode() {
    setLoading(true);
    try {
      const res = await requestPhoneOtp({ data: { phone } });
      setStep("otp");
      setSeconds(60);
      setCode("");
      setDemoCode(res.demoCode ?? null);
      if (res.demoCode) {
        toast.message("کد دمو", {
          description: `کد ورود شما: ${res.demoCode}`,
          duration: 12000,
        });
      } else {
        toast.success("کد تأیید ارسال شد.");
      }
      setTimeout(() => codeRef.current?.focus(), 120);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "ارسال کد ناموفق بود.";
      if (e instanceof TypeError && /fetch/i.test(e.message)) {
        toast.error("اتصال به سرور برقرار نشد.", {
          description: "سرور را اجرا کنید: npm run dev — سپس http://localhost:5175/auth",
          duration: 10000,
        });
      } else if (isOtpDemoMode() && msg.includes("ثبت کد")) {
        toast.error(msg, {
          description:
            "کلید service_role / secret در .env برای این پروژه معتبر نیست. از تنظیمات API کپی کنید.",
          duration: 15000,
        });
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  async function confirmCode() {
    if (code.trim().length !== 4) {
      toast.error("کد ۴ رقمی را وارد کنید.");
      return;
    }
    setLoading(true);
    try {
      const { registered, emailOtp, email } = await verifyPhoneOtp({ data: { phone, code } });
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: emailOtp,
        type: "magiclink",
      });
      if (error) throw new Error("ورود ناموفق بود. دوباره تلاش کنید.");
      await router.invalidate();

      if (registered) {
        toast.success("خوش آمدید 👋");
        navigate({ to: afterAuthPath, replace: true });
      } else {
        toast.message("حسابی با این شماره وجود ندارد", {
          description: "برای ادامه، ثبت‌نام را تکمیل کنید.",
        });
        setStep("signup");
      }
    } catch (e) {
      if (e instanceof TypeError && /fetch/i.test(e.message)) {
        toast.error("اتصال به سرور برقرار نشد.", {
          description: "سرور را اجرا کنید: npm run dev — سپس http://localhost:5175/auth",
          duration: 10000,
        });
      } else {
        toast.error(e instanceof Error ? e.message : "تأیید کد ناموفق بود.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function completeSignup() {
    if (fullName.trim().length < 3) {
      toast.error("نام و نام خانوادگی را کامل وارد کنید.");
      return;
    }
    if (!normalizeNationalId(nationalId)) {
      toast.error("کد ملی معتبر نیست.", {
        description: "باید ۱۰ رقم باشد و رقم کنترل (آخر) درست باشد — نه هر ۱۰ رقم تصادفی.",
      });
      return;
    }
    setLoading(true);
    try {
      await updateMyProfile({
        data: {
          fullName: fullName.trim(),
          nationalId: nationalId.trim(),
          jobTitle: jobTitle.trim(),
          education: education || "",
        },
      });
      toast.success("ثبت‌نام با موفقیت انجام شد 👋");
      navigate({ to: afterAuthPath, replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ذخیره اطلاعات ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-center" />
      <div className="grid min-h-screen lg:grid-cols-2">
        <aside className="relative hidden overflow-hidden border-l border-hairline bg-surface lg:block">
          <div className="absolute inset-0 hero-glow opacity-70" />
          <div className="absolute inset-0 grid-bg opacity-60" />
          <div className="relative flex h-full flex-col justify-between p-12">
            <Link to="/" className="flex items-center gap-2">
              <img src={logo.url} alt="لوگوی آغاز" className="h-9 w-9 object-contain" />
              <span className="text-[15px] font-semibold tracking-tight">آغاز</span>
            </Link>
            <div>
              <h2 className="max-w-sm text-3xl font-semibold leading-snug text-balance">
                یک حساب، دسترسی کامل به میزهای اشتراکی آغاز.
              </h2>
              <ul className="mt-8 space-y-3">
                {perks.map((p) => (
                  <li key={p} className="flex items-center gap-3 text-[14px] text-muted-foreground">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/10 text-primary">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              ورود شما با کد یکبار مصرف محافظت می‌شود.
            </div>
            {isOtpDemoMode() && (step === "phone" || step === "otp") && (
              <OtpDemoBadge className="mt-4" />
            )}
          </div>
        </aside>

        <main className="flex items-center justify-center px-6 py-14">
          <div className="w-full max-w-sm">
            <Link
              to="/"
              className="mb-8 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition hover:text-foreground lg:hidden"
            >
              <ArrowRight className="h-3.5 w-3.5" />
              بازگشت به سایت
            </Link>

            {step === "phone" ? (
              <>
                <div className="mb-7">
                  <h1 className="text-[26px] font-semibold tracking-tight">ورود یا ثبت‌نام</h1>
                  {isOtpDemoMode() && (
                    <div className="mt-3">
                      <OtpDemoBadge />
                    </div>
                  )}
                  <p className="mt-2 text-[13.5px] leading-6 text-muted-foreground">
                    شماره موبایل خود را وارد کنید. کد تأیید برایتان ارسال می‌شود.
                  </p>
                </div>

                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void sendCode();
                  }}
                >
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-[13px]">شماره موبایل</Label>
                    <div className="relative">
                      <Phone className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="phone"
                        inputMode="tel"
                        dir="ltr"
                        value={phone}
                        maxLength={20}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="0912 345 6789"
                        className="h-11 pr-10 text-left text-[14px] tracking-wide"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading || phone.trim().length < 8}
                    className="h-11 w-full rounded-full text-[14px]"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "دریافت کد ورود"}
                  </Button>
                </form>

                <p className="mt-6 text-center text-[12px] leading-6 text-muted-foreground">
                  با ادامه، قوانین و سیاست حفظ حریم خصوصی آغاز را می‌پذیرید.
                </p>
              </>
            ) : step === "otp" ? (
              <>
                <div className="mb-7">
                  <div className="mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <h1 className="text-[26px] font-semibold tracking-tight">کد تأیید را وارد کنید</h1>
                  {isOtpDemoMode() && (
                    <div className="mt-3">
                      <OtpDemoBadge />
                    </div>
                  )}
                  <p className="mt-2 text-[13.5px] leading-6 text-muted-foreground">
                    کد ۴ رقمی برای شماره{" "}
                    <span dir="ltr" className="font-medium text-foreground">
                      {toFa(phone)}
                    </span>{" "}
                    ارسال شد.
                  </p>
                </div>

                {demoCode ? (
                  <div className="mb-5 rounded-2xl border border-warning/35 bg-warning/10 px-4 py-4">
                    <div className="mb-2 flex items-center gap-2">
                      <OtpDemoBadge className="border-0 bg-transparent px-0 py-0" />
                    </div>
                    <p className="text-[13px] leading-6 text-muted-foreground">
                      سرویس پیامک متصل نیست. از این کد برای ورود استفاده کنید:
                    </p>
                    <p
                      dir="ltr"
                      className="mt-2 text-center text-3xl font-semibold tracking-[0.35em] text-foreground"
                    >
                      {demoCode}
                    </p>
                  </div>
                ) : isOtpDemoMode() ? (
                  <div className="mb-5 rounded-xl border border-hairline bg-surface px-4 py-3 text-[12.5px] leading-6 text-muted-foreground">
                    در حالت دمو، کد ورود پس از درخواست در همین بخش نمایش داده می‌شود.
                  </div>
                ) : null}

                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void confirmCode();
                  }}
                >
                  <Input
                    ref={codeRef}
                    dir="ltr"
                    inputMode="numeric"
                    maxLength={4}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="----"
                    className="h-14 text-center text-2xl font-semibold tracking-[0.5em]"
                  />
                  <Button
                    type="submit"
                    disabled={loading || code.length !== 4}
                    className="h-11 w-full rounded-full text-[14px]"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "تأیید و ادامه"}
                  </Button>
                </form>

                <div className="mt-6 flex items-center justify-between text-[12.5px]">
                  <button
                    type="button"
                    onClick={resetToPhone}
                    className="text-muted-foreground transition hover:text-foreground"
                  >
                    تغییر شماره
                  </button>
                  <button
                    type="button"
                    disabled={seconds > 0 || loading}
                    onClick={() => void sendCode()}
                    className="text-primary transition disabled:text-muted-foreground"
                  >
                    {seconds > 0 ? `ارسال مجدد در ${toFa(seconds)} ثانیه` : "ارسال مجدد کد"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mb-7">
                  <h1 className="text-[26px] font-semibold tracking-tight">تکمیل ثبت‌نام</h1>
                  <p className="mt-2 text-[13.5px] leading-6 text-muted-foreground">
                    شماره موبایل شما تأیید شد. برای رزرو میز، اطلاعات خود را وارد کنید.
                  </p>
                </div>

                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void completeSignup();
                  }}
                >
                  <div className="space-y-2">
                    <Label htmlFor="signupPhone" className="text-[13px]">شماره موبایل</Label>
                    <div className="relative">
                      <Phone className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="signupPhone"
                        dir="ltr"
                        readOnly
                        value={phone}
                        className="h-11 pr-10 text-left text-[14px] tracking-wide bg-surface"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-[13px]">نام و نام خانوادگی</Label>
                    <div className="relative">
                      <User className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="fullName"
                        value={fullName}
                        maxLength={80}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="مثلاً سارا محمدی"
                        className="h-11 pr-10 text-[14px]"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nationalId" className="text-[13px]">کد ملی</Label>
                    <div className="relative">
                      <IdCard className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="nationalId"
                        dir="ltr"
                        inputMode="numeric"
                        maxLength={10}
                        value={nationalId}
                        onChange={(e) => setNationalId(e.target.value.replace(/\D/g, ""))}
                        placeholder="0123456789"
                        className="h-11 pr-10 text-left text-[14px] tracking-wide"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="jobTitle" className="text-[13px]">شغل</Label>
                    <div className="relative">
                      <Briefcase className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="jobTitle"
                        value={jobTitle}
                        maxLength={80}
                        onChange={(e) => setJobTitle(e.target.value)}
                        placeholder="مثلاً برنامه‌نویس فرانت‌اند"
                        className="h-11 pr-10 text-[14px]"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="education" className="text-[13px]">تحصیلات</Label>
                    <select
                      id="education"
                      value={education}
                      onChange={(e) => setEducation(e.target.value)}
                      className="h-11 w-full rounded-md border border-input bg-background px-3 text-[14px] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      <option value="">انتخاب کنید</option>
                      {EDUCATION_OPTIONS.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="h-11 w-full rounded-full text-[14px]"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "ثبت‌نام و ادامه"}
                  </Button>
                </form>

                <div className="mt-6 text-center text-[12.5px]">
                  <button
                    type="button"
                    onClick={resetToPhone}
                    className="text-muted-foreground transition hover:text-foreground"
                  >
                    تغییر شماره
                  </button>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
