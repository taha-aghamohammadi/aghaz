import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { BookingProvider } from "@/components/site/BookingDialog";
import { logo } from "@/lib/site-assets";

export const Route = createFileRoute("/brand")({
  head: () => ({
    meta: [
      { title: "کیت راهنمای برند آغاز | رنگ، تایپوگرافی و دکمه‌ها" },
      {
        name: "description",
        content:
          "راهنمای برند فضای کار اشتراکی آغاز: پالت رنگی نارنجی، تایپوگرافی وزیرمتن، شعاع گوشه‌ها و استایل استاندارد دکمه‌ها برای یکپارچگی همه صفحات.",
      },
      { property: "og:title", content: "کیت راهنمای برند آغاز" },
      {
        property: "og:description",
        content: "پالت رنگی، تایپوگرافی، شعاع گوشه و استایل دکمه‌های برند آغاز در یک صفحه.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BrandPage,
});

const COLORS = [
  { name: "Primary — نارنجی برند", token: "bg-primary", text: "text-primary-foreground", value: "oklch(0.685 0.192 45)" },
  { name: "Foreground — متن اصلی", token: "bg-foreground", text: "text-background", value: "var(--foreground)" },
  { name: "Background — پس‌زمینه", token: "bg-background", text: "text-foreground", value: "var(--background)" },
  { name: "Surface — سطح ملایم", token: "bg-surface", text: "text-foreground", value: "var(--surface)" },
  { name: "Surface 2 — سطح دوم", token: "bg-surface-2", text: "text-foreground", value: "var(--surface-2)" },
  { name: "Muted — متن کم‌رنگ", token: "bg-muted", text: "text-muted-foreground", value: "var(--muted)" },
  { name: "Success — موفق", token: "bg-success", text: "text-background", value: "var(--success)" },
  { name: "Warning — هشدار", token: "bg-warning", text: "text-background", value: "var(--warning)" },
  { name: "Destructive — خطا", token: "bg-destructive", text: "text-destructive-foreground", value: "var(--destructive)" },
  { name: "Hairline — خط جداکننده", token: "bg-hairline", text: "text-foreground", value: "var(--hairline)" },
];

const TYPE_SCALE = [
  { label: "Display / تیتر اصلی", cls: "text-5xl md:text-7xl font-semibold tracking-tight", note: "text-5xl md:text-7xl · font-semibold" },
  { label: "H2 / تیتر بخش", cls: "text-3xl md:text-4xl font-semibold tracking-tight", note: "text-3xl md:text-4xl · font-semibold" },
  { label: "H3 / تیتر کارت", cls: "text-xl font-semibold tracking-tight", note: "text-xl · font-semibold" },
  { label: "Body / متن اصلی", cls: "text-[15px] leading-relaxed", note: "text-[15px] · leading-relaxed" },
  { label: "Small / متن فرعی", cls: "text-[13.5px] text-muted-foreground", note: "text-[13.5px] · text-muted-foreground" },
  { label: "Caption / برچسب", cls: "text-xs text-muted-foreground", note: "text-xs · text-muted-foreground" },
];

const RADII = [
  { name: "sm", cls: "rounded-sm", note: "0.375rem" },
  { name: "md", cls: "rounded-md", note: "0.5rem" },
  { name: "lg", cls: "rounded-lg", note: "0.875rem — پیش‌فرض" },
  { name: "xl", cls: "rounded-xl", note: "1.125rem" },
  { name: "2xl", cls: "rounded-2xl", note: "1.375rem — کارت‌ها" },
  { name: "full", cls: "rounded-full", note: "دکمه‌ها و برچسب‌ها" },
];

function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-hairline py-14">
      <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">{title}</h2>
      <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-muted-foreground">{desc}</p>
      <div className="mt-8">{children}</div>
    </section>
  );
}

function BrandPage() {
  return (
    <BookingProvider>
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="mx-auto max-w-5xl px-6 pb-10 pt-16">
          <div className="flex flex-wrap items-center gap-4">
            <img src={logo.url} alt="لوگوی آغاز" className="h-14 w-14 object-contain" />
            <div>
              <p className="text-xs text-muted-foreground">کیت راهنمای برند</p>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                سیستم طراحی آغاز
              </h1>
            </div>
          </div>
          <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            این صفحه مرجع واحد ظاهر محصول است. رنگ‌ها، تایپوگرافی، شعاع گوشه‌ها و دکمه‌ها همه از
            توکن‌های معنایی تعریف‌شده در <span dir="ltr" className="font-medium text-foreground">src/styles.css</span>{" "}
            می‌آیند؛ پس هر تغییری در این توکن‌ها همه‌ی صفحات را هم‌زمان و یکپارچه بروز می‌کند.
          </p>

          <Section
            title="پالت رنگی"
            desc="نارنجی برند تنها رنگ تأکیدی است و فقط برای اقدام اصلی، تمرکز و وضعیت فعال به کار می‌رود. بقیه‌ی رابط کاربری روی خنثی‌های سرد و روشن ساخته می‌شود."
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {COLORS.map((c) => (
                <div key={c.name} className="overflow-hidden rounded-2xl border border-hairline">
                  <div className={`grid h-24 place-items-center ${c.token} ${c.text}`}>
                    <span dir="ltr" className="text-[12px] font-medium">{c.token}</span>
                  </div>
                  <div className="bg-background p-3">
                    <p className="text-[13.5px] font-medium">{c.name}</p>
                    <p dir="ltr" className="mt-1 text-[11.5px] text-muted-foreground">{c.value}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-5 rounded-xl border border-hairline bg-surface p-4 text-[13px] text-muted-foreground">
              قاعده: هرگز رنگ ثابت مثل <span dir="ltr">text-white</span> یا کد هگز داخل کامپوننت
              نوشته نمی‌شود؛ همیشه از همین توکن‌ها استفاده کنید تا حالت تاریک هم درست بماند.
            </p>
          </Section>

          <Section
            title="تایپوگرافی"
            desc="فونت وزیرمتن برای کل محصول. تیترها با وزن ۶۰۰ و فاصله‌ی حروف فشرده، و متن‌ها با ارتفاع خط باز برای خوانایی فارسی."
          >
            <div className="divide-y divide-hairline overflow-hidden rounded-2xl border border-hairline">
              {TYPE_SCALE.map((t) => (
                <div key={t.label} className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <p className={t.cls}>هر اتفاق بزرگی، یک آغاز دارد</p>
                  <div className="text-left">
                    <p className="text-[12px] text-muted-foreground">{t.label}</p>
                    <p dir="ltr" className="text-[11.5px] text-muted-foreground">{t.note}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section
            title="شعاع گوشه‌ها"
            desc="مقیاس شعاع از توکن پایه ۰٫۸۷۵rem ساخته می‌شود. کارت‌ها ۲xl، ورودی‌ها md تا lg و دکمه‌ها و برچسب‌ها کاملاً گرد."
          >
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {RADII.map((r) => (
                <div key={r.name} className="text-center">
                  <div className={`h-20 border border-hairline bg-surface-2 ${r.cls}`} />
                  <p dir="ltr" className="mt-2 text-[12.5px] font-medium">rounded-{r.name}</p>
                  <p className="text-[11.5px] text-muted-foreground">{r.note}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section
            title="دکمه‌ها"
            desc="اقدام اصلی هر صفحه یک دکمه‌ی پرشده‌ی نارنجی و گرد است. بقیه‌ی اقدام‌ها به ترتیب اهمیت از outline، secondary، ghost و link استفاده می‌کنند."
          >
            <div className="space-y-6 rounded-2xl border border-hairline bg-surface/60 p-6">
              <div className="flex flex-wrap items-center gap-3">
                <Button className="h-11 rounded-full px-6 text-[14px]">رزرو میز</Button>
                <Button variant="outline" className="h-11 rounded-full border-hairline px-6 text-[14px]">
                  مشاهده تعرفه‌ها
                </Button>
                <Button variant="secondary" className="h-11 rounded-full px-6 text-[14px]">ثانویه</Button>
                <Button variant="ghost" className="h-11 rounded-full px-5 text-[14px]">شفاف</Button>
                <Button variant="link" className="text-[14px]">لینکی</Button>
                <Button variant="destructive" className="h-11 rounded-full px-6 text-[14px]">لغو رزرو</Button>
              </div>
              <div className="flex flex-wrap items-center gap-3 border-t border-hairline pt-6">
                <Button size="sm" className="rounded-full px-4 text-[13px]">کوچک</Button>
                <Button className="rounded-full px-5 text-[13.5px]">معمولی</Button>
                <Button size="lg" className="h-12 rounded-full px-6 text-[14px]">بزرگ</Button>
                <Button disabled className="rounded-full px-5 text-[13.5px]">غیرفعال</Button>
              </div>
              <ul className="space-y-2 border-t border-hairline pt-6 text-[13px] text-muted-foreground">
                <li>• در هر بخش فقط یک دکمه‌ی اصلی نارنجی؛ باقی اقدام‌ها کم‌تأکید.</li>
                <li>• همه‌ی دکمه‌های اصلی سایت گرد کامل با ارتفاع ۴۴ تا ۴۸ پیکسل هستند.</li>
                <li>• آیکون در RTL سمت چپ متن قرار می‌گیرد و اندازه‌اش ۱۶ پیکسل است.</li>
              </ul>
            </div>
          </Section>

          <Section
            title="لوگو و فاصله‌گذاری"
            desc="لوگو همیشه با حاشیه‌ی امن به اندازه‌ی نصف ارتفاع خودش استفاده می‌شود و روی پس‌زمینه‌ی ساده می‌نشیند. کشیدن، چرخاندن یا تغییر رنگ آن مجاز نیست."
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid place-items-center rounded-2xl border border-hairline bg-background p-8">
                <img src={logo.url} alt="لوگوی آغاز روی پس‌زمینه روشن" className="h-16 w-16 object-contain" />
              </div>
              <div className="grid place-items-center rounded-2xl border border-hairline bg-surface-2 p-8">
                <img src={logo.url} alt="لوگوی آغاز روی سطح خاکستری" className="h-16 w-16 object-contain" />
              </div>
              <div className="grid place-items-center rounded-2xl border border-hairline bg-foreground p-8">
                <img src={logo.url} alt="لوگوی آغاز روی پس‌زمینه تیره" className="h-16 w-16 object-contain" />
              </div>
            </div>
          </Section>

          <div className="py-12">
            <Button asChild className="rounded-full px-6 text-[14px]">
              <Link to="/">بازگشت به صفحه اصلی</Link>
            </Button>
          </div>
        </main>
        <SiteFooter />
      </div>
    </BookingProvider>
  );
}
