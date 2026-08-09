import { Link } from "@tanstack/react-router";
import { logo } from "@/lib/site-assets";

export function SiteFooter() {
  const cols = [
    { title: "محصول", links: [
      { label: "میزها", href: "#" },
      { label: "قیمت‌ها", href: "#" },
      { label: "رزرو", href: "#" },
      { label: "درب هوشمند", href: "#" },
      { label: "راهنمای برند", href: "/brand" },
    ]},
    { title: "شرکت", links: [
      { label: "درباره ما", href: "#" },
      { label: "تماس", href: "#" },
      { label: "فرصت‌های شغلی", href: "#" },
    ]},
    { title: "منابع", links: [
      { label: "مرکز راهنما", href: "#" },
      { label: "راهنمای اعضا", href: "#" },
      { label: "وضعیت سرویس", href: "#" },
    ]},
    { title: "حقوقی", links: [
      { label: "حریم خصوصی", href: "#" },
      { label: "قوانین و مقررات", href: "#" },
      { label: "کوکی‌ها", href: "#" },
    ]},
  ];
  return (
    <footer className="border-t border-hairline bg-surface/40">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <div className="flex items-center gap-2">
              <img src={logo.url} alt="لوگوی آغاز" className="h-8 w-8 object-contain" />
              <span className="text-[15px] font-semibold tracking-tight">آغاز</span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              تجربه‌ای هوشمند از کار اشتراکی. رزرو کن، وارد شو و کار کن — همه‌چیز خودکار.
            </p>
            <div className="mt-6 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex h-2 w-2 rounded-full bg-success" />
              همه سرویس‌ها فعال هستند
            </div>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <div className="text-[13px] font-semibold text-foreground">{c.title}</div>
              <ul className="mt-4 space-y-3">
                {c.links.map((l) => (
                  <li key={l.label}>
                    {l.href === "/brand" ? (
                      <Link to={l.href} className="text-[13px] text-muted-foreground transition hover:text-foreground">
                        {l.label}
                      </Link>
                    ) : (
                      <a href={l.href} className="text-[13px] text-muted-foreground transition hover:text-foreground">
                        {l.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex justify-center border-b border-hairline pb-8">
          <p className="text-center text-sm leading-relaxed text-muted-foreground">
            آغاز؛ قدرت گرفته از زیست بوم نوآوری حیات و دانشگاه صنعتی نوشیروانی
          </p>
        </div>
        <div className="mt-8 flex flex-col items-start justify-between gap-4 text-xs text-muted-foreground md:flex-row md:items-center">
          <div>© {new Date().getFullYear()} آغاز. تمام حقوق محفوظ است.</div>
          <div>تجربه‌ای هوشمند از کار اشتراکی.</div>
        </div>
      </div>
    </footer>
  );
}
