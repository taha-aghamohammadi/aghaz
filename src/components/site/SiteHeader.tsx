import { Link } from "@tanstack/react-router";
import { LayoutDashboard, LogOut, Menu, ShieldCheck, User, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useBooking } from "@/components/site/BookingDialog";
import { supabase } from "@/integrations/supabase/client";
import { logo } from "@/lib/site-assets";

const links = [
  { label: "میزها", href: "#spaces" },
  { label: "امکانات", href: "#features" },
  { label: "چطور کار می‌کنه", href: "#how" },
  { label: "قیمت‌ها", href: "#pricing" },
  { label: "سوالات", href: "#faq" },
  { label: "برند", href: "/brand" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [isStaff, setIsStaff] = useState(false);
  const { open: openBooking } = useBooking();

  useEffect(() => {
    async function sync(userId: string | undefined) {
      setSignedIn(!!userId);
      if (!userId) {
        setIsStaff(false);
        return;
      }
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      setIsStaff((data ?? []).some((r) => r.role === "admin" || r.role === "staff"));
    }
    supabase.auth.getUser().then(({ data }) => void sync(data.user?.id));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      void sync(session?.user?.id);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setSignedIn(false);
    setIsStaff(false);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-hairline/60 bg-background/70 backdrop-blur-xl">
      <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:gap-3 sm:px-6">
        <Link to="/" className="relative z-10 flex shrink-0 items-center gap-2">
          <img src={logo.url} alt="لوگوی آغاز" className="h-8 w-8 object-contain" />
          <span className="text-[15px] font-semibold tracking-tight">آغاز</span>
        </Link>

        <nav
          className="absolute left-1/2 top-1/2 hidden max-w-[calc(100%-10.5rem)] -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-3 overflow-x-auto px-1 sm:max-w-[calc(100%-12rem)] lg:flex xl:max-w-[calc(100%-14rem)] xl:gap-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="ناوبری اصلی"
        >
          {links.map((l) =>
            l.href.startsWith("#") ? (
              <a
                key={l.href}
                href={l.href}
                className="shrink-0 text-[13.5px] text-muted-foreground transition hover:text-foreground"
              >
                {l.label}
              </a>
            ) : (
              <Link
                key={l.href}
                to={l.href}
                className="shrink-0 text-[13.5px] text-muted-foreground transition hover:text-foreground"
              >
                {l.label}
              </Link>
            ),
          )}
        </nav>

        <div className="relative z-10 flex shrink-0 items-center gap-1.5 sm:gap-2">
          <div className="hidden items-center gap-1 sm:gap-1.5 md:flex">
            {signedIn ? (
              <>
                {isStaff && (
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0 rounded-full border-hairline px-2.5 text-[13px] sm:px-3 lg:text-[13.5px]"
                  >
                    <Link to="/admin" title="پنل مدیریت">
                      <ShieldCheck className="h-4 w-4 lg:ml-1" />
                      <span className="hidden lg:inline">پنل مدیریت</span>
                    </Link>
                  </Button>
                )}
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="h-8 shrink-0 px-2 text-[13px] lg:px-3 lg:text-[13.5px]"
                >
                  <Link to="/dashboard" title="داشبورد">
                    <LayoutDashboard className="h-4 w-4 lg:ml-1" />
                    <span className="hidden xl:inline">داشبورد</span>
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="h-8 shrink-0 px-2 text-[13px] lg:px-3 lg:text-[13.5px]"
                >
                  <Link to="/account" title="حساب من">
                    <User className="h-4 w-4 lg:ml-1" />
                    <span className="hidden lg:inline">حساب من</span>
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => void signOut()}
                  className="h-8 w-8 shrink-0"
                  title="خروج"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Button asChild variant="ghost" size="sm" className="h-8 shrink-0 text-[13px] lg:text-[13.5px]">
                <Link to="/auth">ورود / ثبت‌نام</Link>
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => openBooking()}
              className="h-8 shrink-0 rounded-full px-3 text-[13px] sm:px-4 lg:text-[13.5px]"
            >
              رزرو میز
            </Button>
          </div>

          <button
            type="button"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-transparent transition hover:bg-surface md:hidden"
            onClick={() => setOpen(!open)}
            aria-label="منو"
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-hairline bg-background md:hidden">
          <div className="flex flex-col gap-1 px-4 py-4 sm:px-6">
            {links.map((l) =>
              l.href.startsWith("#") ? (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-2 py-2 text-sm text-muted-foreground hover:bg-surface hover:text-foreground"
                >
                  {l.label}
                </a>
              ) : (
                <Link
                  key={l.href}
                  to={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-2 py-2 text-sm text-muted-foreground hover:bg-surface hover:text-foreground"
                >
                  {l.label}
                </Link>
              ),
            )}
            {signedIn && (
              <Link
                to="/dashboard"
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-2 text-sm text-muted-foreground hover:bg-surface hover:text-foreground"
              >
                داشبورد
              </Link>
            )}
            {isStaff && (
              <Link
                to="/admin"
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-2 text-sm font-medium text-primary hover:bg-surface"
              >
                پنل مدیریت
              </Link>
            )}
            <Link
              to={signedIn ? "/account" : "/auth"}
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-2 text-sm text-muted-foreground hover:bg-surface hover:text-foreground"
            >
              {signedIn ? "حساب من" : "ورود / ثبت‌نام"}
            </Link>
            <Button
              onClick={() => {
                setOpen(false);
                openBooking();
              }}
              className="mt-2 rounded-full"
            >
              رزرو میز
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
