import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { getMyAccess, listMembers, setMemberRole } from "@/lib/admin.functions";
import { ROLE_LABEL, faDate, faNumber, toman } from "@/lib/fa-format";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin/members")({
  head: () => ({
    meta: [
      { title: "مدیریت کاربران | آغاز" },
      { name: "description", content: "لیست کاربران آغاز، اطلاعات پروفایل، تعداد رزرو و تعیین نقش مدیر یا کارمند." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "مدیریت کاربران | آغاز" },
      { property: "og:description", content: "کاربران و نقش‌های دسترسی فضای کار آغاز." },
    ],
  }),
  component: AdminMembers,
});

function AdminMembers() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const fetchMembers = useServerFn(listMembers);
  const fetchAccess = useServerFn(getMyAccess);
  const updateRole = useServerFn(setMemberRole);

  const { data, isLoading } = useQuery({ queryKey: ["admin-members"], queryFn: () => fetchMembers() });
  const { data: access } = useQuery({ queryKey: ["admin-access"], queryFn: () => fetchAccess() });

  const save = useMutation({
    mutationFn: (input: { userId: string; role: "admin" | "staff" | "user" }) =>
      updateRole({ data: input }),
    onSuccess: () => {
      toast.success("نقش کاربر به‌روزرسانی شد");
      void qc.invalidateQueries({ queryKey: ["admin-members"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = useMemo(() => {
    const list = data ?? [];
    const q = search.trim();
    if (!q) return list;
    return list.filter(
      (m) =>
        m.full_name.includes(q) ||
        m.phone.includes(q) ||
        m.national_id.includes(q) ||
        m.job_title.includes(q),
    );
  }, [data, search]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold">کاربران</h2>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {faNumber(data?.length ?? 0)} کاربر ثبت‌نام کرده‌اند.
          </p>
        </div>
        <div className="relative min-w-[220px]">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جست‌وجوی نام، شماره یا کد ملی"
            className="rounded-full border-hairline pr-9"
          />
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-72 rounded-2xl" />
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-hairline px-6 py-16 text-center text-[13px] text-muted-foreground">
          کاربری پیدا نشد.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-hairline">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-right">نام</TableHead>
                <TableHead className="text-right">شماره تماس</TableHead>
                <TableHead className="text-right">کد ملی</TableHead>
                <TableHead className="text-right">شغل / تحصیلات</TableHead>
                <TableHead className="text-right">رزروها</TableHead>
                <TableHead className="text-right">مجموع خرید</TableHead>
                <TableHead className="text-right">عضویت از</TableHead>
                <TableHead className="text-right">نقش</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m) => {
                const role = m.roles.includes("admin")
                  ? "admin"
                  : m.roles.includes("staff")
                    ? "staff"
                    : "user";
                const isSelf = access?.userId === m.id;
                return (
                  <TableRow key={m.id}>
                    <TableCell className="text-[12.5px]">
                      <div className="flex items-center gap-1.5">
                        {m.full_name || "بدون نام"}
                        {role !== "user" && <ShieldCheck className="h-3.5 w-3.5 text-primary" />}
                      </div>
                    </TableCell>
                    <TableCell className="text-[12.5px]" dir="ltr">
                      {m.phone || "—"}
                    </TableCell>
                    <TableCell className="text-[12.5px]" dir="ltr">
                      {m.national_id || "—"}
                    </TableCell>
                    <TableCell className="text-[12px] text-muted-foreground">
                      {[m.job_title, m.education].filter(Boolean).join(" · ") || "—"}
                    </TableCell>
                    <TableCell className="text-[12.5px]">{faNumber(m.bookingCount)}</TableCell>
                    <TableCell className="text-[12.5px]">{toman(m.totalSpent)}</TableCell>
                    <TableCell className="text-[12px] text-muted-foreground">
                      {faDate(m.created_at)}
                    </TableCell>
                    <TableCell>
                      {access?.isAdmin && !isSelf ? (
                        <Select
                          value={role}
                          onValueChange={(v) =>
                            save.mutate({ userId: m.id, role: v as "admin" | "staff" | "user" })
                          }
                        >
                          <SelectTrigger className="h-8 w-[110px] text-[12px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(ROLE_LABEL).map(([k, v]) => (
                              <SelectItem key={k} value={k}>
                                {v}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="secondary" className="rounded-full text-[11px] font-normal">
                          {ROLE_LABEL[role]}
                          {isSelf ? " (شما)" : ""}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
