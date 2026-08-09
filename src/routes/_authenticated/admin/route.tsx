import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3, CalendarCheck, Coins, LayoutGrid, ShieldAlert, Users, Wallet } from "lucide-react";
import { getMyAccess } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import logo from "@/assets/aghaz-logo.png.asset.json";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "داشبورد", icon: BarChart3, exact: true },
  { to: "/admin/bookings", label: "رزروها", icon: CalendarCheck, exact: false },
  { to: "/admin/desks", label: "میزها", icon: LayoutGrid, exact: false },
  { to: "/admin/pricing", label: "تعرفه‌ها", icon: Coins, exact: false },
  { to: "/admin/members", label: "کاربران", icon: Users, exact: false },
  { to: "/admin/finance", label: "حسابداری", icon: Wallet, exact: false },
] as const;

function AdminLayout() {
  const fetchAccess = useServerFn(getMyAccess);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data, isLoading } = useQuery({
    queryKey: ["admin-access"],
    queryFn: () => fetchAccess(),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-20 text-center text-[13px] text-muted-foreground">
        در حال بررسی دسترسی…
      </div>
    );
  }

  if (!data?.isStaff) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="h-7 w-7" />
        </span>
        <h1 className="mt-4 text-[19px] font-semibold">دسترسی مدیریتی ندارید</h1>
        <p className="mt-2 text-[13px] leading-7 text-muted-foreground">
          این بخش مخصوص مدیران و کارمندان آغاز است. اگر باید دسترسی داشته باشید، از مدیر مجموعه
          بخواهید نقش شما را تغییر دهد.
        </p>
        <Button asChild variant="outline" className="mt-6 rounded-full border-hairline">
          <Link to="/">بازگشت به سایت</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-[70vh]">
      <div className="border-b border-hairline bg-surface/40">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <img src={logo.url} alt="آغاز" className="h-9 w-9 object-contain" />
            <div>
              <h1 className="text-[18px] font-semibold tracking-tight">پنل مدیریت آغاز</h1>
              <p className="text-[12px] text-muted-foreground">
                {data.isAdmin ? "دسترسی مدیر کل" : "دسترسی کارمند"}
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="w-fit rounded-full border-hairline">
            <Link to="/">مشاهده سایت</Link>
          </Button>
        </div>
        <div className="mx-auto max-w-7xl overflow-x-auto px-6">
          <nav className="flex min-w-max items-center gap-1 pb-3">
            {NAV.map((item) => {
              const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-[13px] transition ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-surface hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-6 py-8">
        <Outlet />
      </div>
    </div>
  );
}
