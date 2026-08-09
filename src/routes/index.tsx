import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  BadgeCheck,
  Calendar,
  Check,
  Coffee,
  DoorOpen,
  KeyRound,
  Minus,
  MonitorSmartphone,
  Plus,
  QrCode,
  ScanFace,
  Sparkles,
  Star,
  Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { BookingProvider, useBooking, type BookingType } from "@/components/site/BookingDialog";
import { LiveDeskMap } from "@/components/site/LiveDeskMap";
import { getPublicPricing } from "@/lib/booking.functions";
import { DEFAULT_PRICING, unitPriceForType } from "@/lib/booking.service";
import { pricingMainAmount, pricingUnitLabel } from "@/lib/fa-format";
import { Toaster } from "@/components/ui/sonner";
import space1 from "@/assets/space-1.jpg.asset.json";
import space2 from "@/assets/space-2.jpg.asset.json";
import space3 from "@/assets/space-3.jpg.asset.json";
import space4 from "@/assets/space-4.jpg.asset.json";
import space5 from "@/assets/space-5.jpg.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "آغاز — تجربه‌ای هوشمند از کار اشتراکی" },
      {
        name: "description",
        content:
          "میز اشتراکی به‌صورت ساعتی، روزانه و ماهانه رزرو کن. ورود با درب هوشمند، پرداخت آنلاین و تجربه‌ای کاملاً بی‌دردسر.",
      },
      { property: "og:title", content: "آغاز — تجربه‌ای هوشمند از کار اشتراکی" },
      {
        property: "og:description",
        content:
          "میز اشتراکی به‌صورت ساعتی، روزانه و ماهانه رزرو کن. ورود با درب هوشمند و پرداخت آنلاین.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <BookingProvider>
        <SiteHeader />
        <main>
          <Hero />
          <LogosStrip />
          <Features />
          <Spaces />
          <Gallery />
          <HowItWorks />
          <LiveDeskMap />
          <Testimonials />
          <Pricing />
          <FAQ />
          <CTA />
        </main>
        <SiteFooter />
        <Toaster position="top-center" richColors />
      </BookingProvider>
    </div>
  );
}

/* ---------- HERO ---------- */

function Hero() {
  const { open } = useBooking();
  return (
    <section className="relative overflow-hidden border-b border-hairline">
      <div className="absolute inset-0 hero-glow opacity-70" />
      <div className="absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute -right-24 top-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl animate-float-slow" />
      <div className="pointer-events-none absolute left-0 top-40 h-96 w-96 rounded-full bg-primary/10 blur-3xl animate-float-slower" />

      <div className="relative mx-auto max-w-7xl px-6 pb-24 pt-20 md:pb-32 md:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-hairline bg-background/70 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            میز اشتراکی — ساعتی، روزانه، ماهانه
            <ArrowLeft className="h-3.5 w-3.5" />
          </div>
          <h1 className="mt-6 text-balance text-5xl font-semibold leading-[1.15] tracking-tight md:text-7xl">
            هر اتفاق بزرگی،<br />
            <span className="bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">
              یک آغاز دارد.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-relaxed text-muted-foreground">
            آغاز یک تجربه کار اشتراکی هوشمنده؛ میز خودت رو ساعتی، روزانه
            یا ماهانه رزرو کن — پرداخت، ورود و مدیریت کاملاً آنلاین.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" onClick={() => open()} className="h-12 rounded-full px-6 text-[14px]">
              رزرو میز
              <ArrowLeft className="mr-1.5 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" asChild className="h-12 rounded-full border-hairline bg-background/60 px-6 text-[14px] backdrop-blur">
              <a href="#pricing">مشاهده تعرفه‌ها</a>
            </Button>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-primary" /> بدون نیاز به اپ</span>
            <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-primary" /> پرداخت آنلاین</span>
            <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-primary" /> لغو هر زمان</span>
          </div>
        </div>

        <HeroPreview />
      </div>
    </section>
  );
}

function HeroPreview() {
  return (
    <div className="relative mx-auto mt-16 max-w-5xl">
      <div className="absolute inset-x-10 -top-4 h-16 rounded-t-3xl bg-gradient-to-b from-primary/10 to-transparent blur-2xl" />
      <div className="relative overflow-hidden rounded-2xl border border-hairline bg-card shadow-[0_30px_80px_-20px_rgba(0,0,0,0.18)]">
        <img
          src={space1.url}
          alt="نمای فضای کار اشتراکی آغاز با میزهای اشتراکی و نور طبیعی"
          width={1600}
          height={1104}
          className="h-full w-full object-cover"
        />
      </div>
    </div>
  );
}

/* ---------- GALLERY ---------- */

function Gallery() {
  const photos = [
    { src: space1.url, alt: "سالن اصلی فضای کار اشتراکی آغاز", w: 1600, h: 1104, cls: "sm:col-span-2 sm:row-span-2" },
    { src: space4.url, alt: "میزهای کنار پنجره در فضای ساکت", w: 1200, h: 1600, cls: "sm:row-span-2" },
    { src: space3.url, alt: "لانج و کافه فضای کار آغاز", w: 1200, h: 1200, cls: "" },
    { src: space2.url, alt: "جزئیات میز اشتراکی آماده کار", w: 1200, h: 1200, cls: "" },
    { src: space5.url, alt: "ورودی و پذیرش فضای کار آغاز", w: 1600, h: 1104, cls: "sm:col-span-2" },
  ];

  return (
    <section id="gallery" className="border-b border-hairline py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="max-w-2xl">
          <div className="text-[11px] tracking-[0.2em] text-primary">گالری فضا</div>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
            قبل از رزرو، فضا رو ببین
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            نور طبیعی، میزهای اشتراکی راحت، گوشه‌های آرام و یک لانج دنج برای استراحت‌های کوتاه.
          </p>
        </div>

        <div className="mt-10 grid auto-rows-[180px] grid-cols-2 gap-3 sm:auto-rows-[200px] sm:grid-cols-4">
          {photos.map((p) => (
            <figure
              key={p.src}
              className={`group relative overflow-hidden rounded-2xl border border-hairline bg-surface ${p.cls}`}
            >
              <img
                src={p.src}
                alt={p.alt}
                loading="lazy"
                width={p.w}
                height={p.h}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              />
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- LOGOS ---------- */

function LogosStrip() {
  const items = ["نورث‌ویند", "لومن", "اکتاو", "پارالل", "هالو", "مریدین", "استراتا", "آرکاد"];
  return (
    <section className="border-b border-hairline bg-surface/40 py-10">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center text-[11px] tracking-[0.2em] text-muted-foreground">
          مورد اعتماد بنیان‌گذاران، سازندگان و تیم‌های دورکار
        </div>
        <div className="relative mt-6 overflow-hidden">
          <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-background to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-background to-transparent" />
          <div className="flex w-max animate-marquee items-center gap-14 whitespace-nowrap">
            {[...items, ...items].map((n, i) => (
              <span key={i} className="text-lg font-semibold tracking-widest text-muted-foreground/70">
                {n}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- FEATURES ---------- */

function Features() {
  const items = [
    { icon: Calendar, title: "رزرو هوشمند", desc: "در چند ثانیه میزت رو ساعتی، روزانه یا ماهانه رزرو کن." },
    { icon: KeyRound, title: "درب هوشمند", desc: "در ساعت رزروت، درب ساختمان با حساب کاربری‌ت باز می‌شه." },
    { icon: QrCode, title: "پرداخت آنلاین", desc: "کارت بانکی، کیف پول یا اعتبار اشتراک — همه در چند ثانیه." },
    { icon: Coffee, title: "کافه اختصاصی", desc: "قهوه تخصصی، نامحدود — مهمون ما." },
  ];
  return (
    <section id="features" className="border-b border-hairline py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeader
          eyebrow="همه چیز شامل می‌شه"
          title="فضایی که خودش خودش رو می‌چرخونه."
          subtitle="از لحظه رزرو تا لحظه خروج، هر مرحله دیجیتال، خودکار و بی‌دردسر."
        />
        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-4">
          {items.map((it) => (
            <div key={it.title} className="group relative bg-card p-6 transition hover:bg-surface">
              <div className="grid h-10 w-10 place-items-center rounded-lg border border-hairline bg-background text-primary transition group-hover:scale-105">
                <it.icon className="h-5 w-5" />
              </div>
              <div className="mt-5 text-[15px] font-semibold">{it.title}</div>
              <div className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">{it.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- SPACES ---------- */

function Spaces() {
  const { open } = useBooking();
  const fetchPricing = useServerFn(getPublicPricing);
  const { data: pricing = DEFAULT_PRICING } = useQuery({
    queryKey: ["public-pricing"],
    queryFn: () => fetchPricing(),
  });

  const items: {
    name: string;
    type: BookingType;
    desc: string;
    price: string;
    unit: string;
    tint: string;
    featured?: boolean;
  }[] = [
    {
      name: "میز ساعتی",
      type: "hourly",
      desc: "هر وقت لازم داری بیا، فقط بابت ساعت‌های استفاده پرداخت کن.",
      price: pricingMainAmount(unitPriceForType(pricing, "hourly")),
      unit: pricingUnitLabel(unitPriceForType(pricing, "hourly"), "hour"),
      tint: "from-primary/20",
    },
    {
      name: "میز روزانه",
      type: "daily",
      desc: "یک روز کامل کار، تعرفه ثابت و بی‌دغدغه.",
      price: pricingMainAmount(unitPriceForType(pricing, "daily")),
      unit: pricingUnitLabel(unitPriceForType(pricing, "daily"), "day"),
      tint: "from-cyan-500/20",
    },
    {
      name: "اشتراک ماهانه",
      type: "monthly",
      desc: "دسترسی نامحدود به میز اشتراکی، در تمام ساعات کاری.",
      price: pricingMainAmount(unitPriceForType(pricing, "monthly")),
      unit: pricingUnitLabel(unitPriceForType(pricing, "monthly"), "month"),
      tint: "from-blue-500/25",
      featured: true,
    },
  ];
  return (
    <section id="spaces" className="border-b border-hairline bg-surface/40 py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeader eyebrow="میز اشتراکی" title="به اندازه‌ی کارت انتخاب کن." subtitle="از یک ساعت تا یک ماه — فقط بابت اون چیزی که استفاده می‌کنی پرداخت کن." />
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((s) => (
            <div key={s.name} className={`group relative overflow-hidden rounded-2xl border ${s.featured ? "border-primary/40" : "border-hairline"} bg-card p-1`}>
              <div className={`relative h-40 overflow-hidden rounded-xl bg-gradient-to-br ${s.tint} to-transparent`}>
                <div className="absolute inset-0 grid-bg opacity-40" />
                <div className="absolute left-3 top-3 rounded-full border border-hairline bg-background/80 px-2 py-0.5 text-[10px] backdrop-blur">
                  {s.featured ? "محبوب‌ترین" : "موجود"}
                </div>
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-center p-6">
                  <div className="h-20 w-40 rounded-t-2xl border-x border-t border-hairline bg-background/70 backdrop-blur" />
                </div>
              </div>
              <div className="p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-[16px] font-semibold">{s.name}</h3>
                  <div className="text-left">
                    <span className="text-xs text-muted-foreground">از </span>
                    <span className="text-[15px] font-semibold">{s.price}</span>
                    <span className="text-xs text-muted-foreground"> {s.unit}</span>
                  </div>
                </div>
                <p className="mt-1 text-[13.5px] text-muted-foreground">{s.desc}</p>
                <Button onClick={() => open({ type: s.type })} variant={s.featured ? "default" : "outline"} className="mt-4 w-full rounded-full">
                  رزرو کن
                  <ArrowLeft className="mr-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- HOW IT WORKS ---------- */

function HowItWorks() {
  const steps = [
    { icon: BadgeCheck, title: "ثبت‌نام", desc: "کمتر از یک دقیقه، حساب کاربری‌ت رو بساز." },
    { icon: ScanFace, title: "احراز هویت", desc: "یک‌بار انجامش بده، برای همیشه معتبره." },
    { icon: Calendar, title: "رزرو", desc: "میز، تاریخ و ساعت رو انتخاب کن." },
    { icon: QrCode, title: "پرداخت آنلاین", desc: "کارت بانکی یا اعتبار اشتراک." },
    { icon: DoorOpen, title: "ورود با درب هوشمند", desc: "درب رو از داشبوردت باز کن." },
    { icon: MonitorSmartphone, title: "شروع کار", desc: "میزت آماده‌ست، بشین و کارت رو شروع کن." },
    { icon: Timer, title: "تمدید آسان", desc: "زمان کم آوردی؟ با یک لمس تمدید کن." },
  ];
  return (
    <section id="how" className="border-b border-hairline py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeader eyebrow="چطور کار می‌کنه" title="از ثبت‌نام تا صندلی، در چند دقیقه." subtitle="یه تجربه محصولی، نه یه فرآیند اداری." />
        <div className="relative mt-14">
          <div className="absolute right-6 top-6 h-[calc(100%-3rem)] w-px bg-hairline md:right-1/2" />
          <div className="space-y-8">
            {steps.map((s, i) => {
              const left = i % 2 === 1;
              return (
                <div key={s.title} className={`relative grid gap-4 md:grid-cols-2 md:gap-10 ${left ? "md:[&>div:first-child]:col-start-2" : ""}`}>
                  <div className={`relative rounded-2xl border border-hairline bg-card p-5 md:p-6 ${left ? "md:text-right" : "md:text-left"}`}>
                    <div className={`flex items-center gap-3 ${left ? "" : "md:justify-end"}`}>
                      <span className="text-[11px] font-mono text-muted-foreground">۰{toFa(i + 1)}</span>
                      <h3 className="text-[16px] font-semibold">{s.title}</h3>
                    </div>
                    <p className="mt-2 text-[13.5px] text-muted-foreground">{s.desc}</p>
                  </div>
                  <div className="absolute right-6 top-6 translate-x-1/2 md:right-1/2">
                    <div className="grid h-10 w-10 place-items-center rounded-full border border-hairline bg-background text-primary shadow-sm">
                      <s.icon className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function toFa(n: number) {
  return String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);
}

/* ---------- TESTIMONIALS ---------- */

function Testimonials() {
  const items = [
    {
      quote:
        "فقط همون درب هوشمند، نحوه کار کردنم رو عوض کرد. رزرو می‌کنم، می‌رم، وارد می‌شم. نه کارت، نه پذیرش.",
      name: "لیلا احمدی",
      role: "بنیان‌گذار، نورث‌ویند",
    },
    {
      quote:
        "آغاز مثل یه محصول واقعی حس می‌شه، نه یه فضای کار اشتراکی. داشبورد بهترین بخش صبح‌های منه.",
      name: "امیر کریمی",
      role: "مهندس ارشد، مریدین",
    },
    {
      quote:
        "میز ساعتی دقیقاً چیزی بود که می‌خواستم. رزرو سریع، پرداخت راحت و تمدید فقط با یک لمس.",
      name: "یاسمن سلطانی",
      role: "طراح محصول",
    },
  ];
  return (
    <section className="border-b border-hairline py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeader eyebrow="اعضا" title="مورد علاقه کسانی که واقعاً کار تحویل می‌دن." />
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {items.map((t) => (
            <figure key={t.name} className="flex h-full flex-col rounded-2xl border border-hairline bg-card p-6">
              <div className="flex items-center gap-1 text-primary">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-current" />
                ))}
              </div>
              <blockquote className="mt-4 flex-1 text-[15px] leading-relaxed text-foreground">
                «{t.quote}»
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-[12px] font-semibold text-primary">
                  {t.name.split(" ").map((s) => s[0]).join("")}
                </div>
                <div>
                  <div className="text-[13px] font-medium">{t.name}</div>
                  <div className="text-[12px] text-muted-foreground">{t.role}</div>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- PRICING ---------- */

function Pricing() {
  const { open } = useBooking();
  const fetchPricing = useServerFn(getPublicPricing);
  const { data: pricing = DEFAULT_PRICING } = useQuery({
    queryKey: ["public-pricing"],
    queryFn: () => fetchPricing(),
  });

  const tiers: {
    name: string;
    type: BookingType;
    price: string;
    unit: string;
    desc: string;
    features: string[];
    featured?: boolean;
  }[] = [
    {
      name: "ساعتی",
      type: "hourly",
      price: pricingMainAmount(unitPriceForType(pricing, "hourly")),
      unit: pricingUnitLabel(unitPriceForType(pricing, "hourly"), "hour"),
      desc: "هر وقت خواستی بیا.",
      features: ["دسترسی به میز آزاد", "کافه اختصاصی", "درب هوشمند", "پرداخت آنلاین"],
    },
    {
      name: "روزانه",
      type: "daily",
      price: pricingMainAmount(unitPriceForType(pricing, "daily")),
      unit: pricingUnitLabel(unitPriceForType(pricing, "daily"), "day"),
      desc: "یک روز کامل، تعرفه ثابت.",
      features: ["میز آزاد تمام روز", "کافه اختصاصی", "درب هوشمند", "تمدید آسان"],
    },
    {
      name: "اشتراک ماهانه",
      type: "monthly",
      price: pricingMainAmount(unitPriceForType(pricing, "monthly")),
      unit: pricingUnitLabel(unitPriceForType(pricing, "monthly"), "month"),
      desc: "دسترسی نامحدود در ساعات کاری.",
      features: [
        "استفاده نامحدود از میز آزاد",
        "اولویت در رزرو",
        "کافه اختصاصی",
        "پاس مهمان",
      ],
      featured: true,
    },
  ];
  return (
    <section id="pricing" className="border-b border-hairline bg-surface/40 py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeader eyebrow="قیمت‌ها" title="ساده، شفاف و انعطاف‌پذیر." subtitle="بدون قرارداد. بدون هزینه پنهان. هر زمان لغو کن." />
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`relative flex flex-col rounded-2xl border p-6 ${
                t.featured
                  ? "border-primary/50 bg-card shadow-[0_30px_80px_-30px_rgba(37,99,235,0.35)]"
                  : "border-hairline bg-card"
              }`}
            >
              {t.featured && (
                <div className="absolute -top-3 right-6 rounded-full bg-primary px-2.5 py-0.5 text-[10.5px] font-medium text-primary-foreground">
                  محبوب‌ترین
                </div>
              )}
              <div className="text-[13px] font-medium text-muted-foreground">{t.name}</div>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-4xl font-semibold tracking-tight">{t.price}</span>
                <span className="text-[13px] text-muted-foreground">{t.unit}</span>
              </div>
              <div className="mt-1 text-[13px] text-muted-foreground">{t.desc}</div>
              <Button onClick={() => open({ type: t.type })} className={`mt-6 rounded-full ${t.featured ? "" : "bg-foreground text-background hover:bg-foreground/90"}`}>
                {t.featured ? "شروع اشتراک" : "شروع کن"}
              </Button>
              <ul className="mt-6 space-y-2.5">
                {t.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-[13.5px]">
                    <Check className="h-4 w-4 text-primary" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- FAQ ---------- */

function FAQ() {
  const faqs = [
    { q: "چطور میز رزرو کنم؟", a: "وارد شو، تاریخ، ساعت و صندلی رو از نقشه لحظه‌ای انتخاب کن و آنلاین پرداخت کن. رزروت بلافاصله تأیید می‌شه." },
    { q: "درب هوشمند چطور کار می‌کنه؟", a: "در بازه زمانی رزروت، دکمه «باز کردن درب» توی داشبوردت فعال می‌شه. با یک لمس درب باز می‌شه — بدون نیاز به کارت." },
    { q: "می‌تونم رزروم رو تمدید کنم؟", a: "بله. ۱۵ دقیقه قبل از پایان زمان، یه اعلان می‌فرستیم. اگه صندلی خالی باشه، با یک لمس تمدیدش کن." },
    { q: "نیاز به نصب اپلیکیشن دارم؟", a: "نه. آغاز کاملاً توی مرورگر اجرا می‌شه — حتی درب هوشمند و پرداخت." },
    { q: "تفاوت پلن ساعتی، روزانه و ماهانه چیه؟", a: "پلن ساعتی برای استفاده‌های کوتاه، پلن روزانه با تعرفه ثابت برای یک روز کامل، و اشتراک ماهانه برای دسترسی نامحدود در ساعات کاری مناسبه." },
  ];
  return (
    <section id="faq" className="border-b border-hairline py-24 md:py-32">
      <div className="mx-auto max-w-3xl px-6">
        <SectionHeader eyebrow="سوالات متداول" title="هر چیزی که ممکنه بپرسی." />
        <Accordion type="single" collapsible className="mt-10 divide-y divide-hairline rounded-2xl border border-hairline bg-card">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`i-${i}`} className="border-0 px-5">
              <AccordionTrigger className="py-5 text-right text-[15px] font-medium hover:no-underline [&>svg]:hidden group">
                <span>{f.q}</span>
                <span className="mr-4 grid h-6 w-6 place-items-center rounded-full border border-hairline text-muted-foreground group-data-[state=open]:hidden">
                  <Plus className="h-3.5 w-3.5" />
                </span>
                <span className="mr-4 hidden h-6 w-6 place-items-center rounded-full border border-primary/40 bg-primary/10 text-primary group-data-[state=open]:grid">
                  <Minus className="h-3.5 w-3.5" />
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-5 text-[14px] leading-relaxed text-muted-foreground">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

/* ---------- CTA ---------- */

function CTA() {
  const { open } = useBooking();
  return (
    <section className="relative overflow-hidden py-24 md:py-32">
      <div className="absolute inset-0 hero-glow opacity-60" />
      <div className="absolute inset-0 grid-bg" />
      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <h2 className="text-balance text-4xl font-semibold tracking-tight md:text-6xl">
          میز کار بعدی‌ات<br />با یک لمس رزرو می‌شه.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          به آغاز بپیوند و کار اشتراکی رو همون‌طوری تجربه کن که باید باشه — هوشمند، آروم و بی‌دردسر.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button size="lg" onClick={() => open()} className="h-12 rounded-full px-6">
            رزرو میز <ArrowLeft className="mr-1 h-4 w-4" />
          </Button>
          <Button size="lg" variant="outline" className="h-12 rounded-full border-hairline bg-background/70 px-6 backdrop-blur">
            صحبت با ما
          </Button>
        </div>
      </div>
    </section>
  );
}

/* ---------- helpers ---------- */

function SectionHeader({
  eyebrow,
  title,
  subtitle,
  align = "center",
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "center" | "start";
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      {eyebrow && (
        <div className="text-[11px] font-medium tracking-[0.2em] text-primary">{eyebrow}</div>
      )}
      <h2 className="mt-3 text-balance text-4xl font-semibold tracking-tight md:text-5xl">{title}</h2>
      {subtitle && <p className="mt-4 text-balance text-[15px] leading-relaxed text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
