import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteDesk, listDesks, saveDesk } from "@/lib/admin.functions";
import { DESK_STATUS_LABEL, faNumber } from "@/lib/fa-format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

export const Route = createFileRoute("/_authenticated/admin/desks")({
  head: () => ({
    meta: [
      { title: "مدیریت میزها و تعرفه‌ها | آغاز" },
      { name: "description", content: "افزودن و ویرایش میزهای اشتراکی، زون‌ها، وضعیت و تعرفه ساعتی، روزانه و ماهانه." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "مدیریت میزها و تعرفه‌ها | آغاز" },
      { property: "og:description", content: "میزها، زون‌ها و تعرفه‌های فضای کار آغاز را مدیریت کنید." },
    ],
  }),
  component: AdminDesks,
});

type DeskForm = {
  id?: string;
  code: string;
  name: string;
  zone: string;
  status: "free" | "busy" | "reserved" | "maintenance";
  features: string;
  locationNote: string;
};

const EMPTY: DeskForm = {
  code: "",
  name: "",
  zone: "",
  status: "free",
  features: "",
  locationNote: "",
};

function AdminDesks() {
  const qc = useQueryClient();
  const [form, setForm] = useState<DeskForm | null>(null);

  const fetchDesks = useServerFn(listDesks);
  const upsertDesk = useServerFn(saveDesk);
  const removeDesk = useServerFn(deleteDesk);

  const { data, isLoading } = useQuery({ queryKey: ["admin-desks"], queryFn: () => fetchDesks() });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["admin-desks"] });
    void qc.invalidateQueries({ queryKey: ["admin-overview"] });
  };

  const save = useMutation({
    mutationFn: (f: DeskForm) =>
      upsertDesk({
        data: {
          ...(f.id ? { id: f.id } : {}),
          code: f.code.trim(),
          name: f.name.trim(),
          zone: f.zone.trim(),
          status: f.status,
          features: f.features.trim(),
          locationNote: f.locationNote.trim(),
          isActive: true,
        },
      }),
    onSuccess: () => {
      toast.success("میز ذخیره شد");
      setForm(null);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeDesk({ data: { id } }),
    onSuccess: () => {
      toast.success("میز حذف شد");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold">میزها</h2>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {faNumber(data?.length ?? 0)} میز ثبت شده است.
          </p>
        </div>
        <Button className="rounded-full" onClick={() => setForm({ ...EMPTY })}>
          <Plus className="ml-1.5 h-4 w-4" />
          میز جدید
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-72 rounded-2xl" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-hairline">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-right">کد</TableHead>
                <TableHead className="text-right">نام</TableHead>
                <TableHead className="text-right">زون</TableHead>
                <TableHead className="text-right">وضعیت</TableHead>
                <TableHead className="text-right">عملیات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-[12.5px]" dir="ltr">
                    {d.code}
                  </TableCell>
                  <TableCell className="text-[12.5px]">
                    <div>{d.name}</div>
                    {d.location_note && (
                      <div className="text-[11px] text-muted-foreground">{d.location_note}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-[12.5px]">{d.zone || "—"}</TableCell>
                  <TableCell>
                    <Badge
                      variant={d.status === "free" ? "default" : "secondary"}
                      className="rounded-full text-[11px] font-normal"
                    >
                      {DESK_STATUS_LABEL[d.status] ?? d.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        title="ویرایش"
                        onClick={() =>
                          setForm({
                            id: d.id,
                            code: d.code,
                            name: d.name,
                            zone: d.zone,
                            status: (d.status as DeskForm["status"]) ?? "free",
                            features: (d.features ?? []).join("، "),
                            locationNote: d.location_note,
                          })
                        }
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        title="حذف"
                        onClick={() => {
                          if (confirm(`میز ${d.code} حذف شود؟`)) remove.mutate(d.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="text-[16px]">
              {form?.id ? "ویرایش میز" : "افزودن میز"}
            </DialogTitle>
            <DialogDescription className="text-[12.5px]">
              کد میز باید یکتا باشد. امکانات را با «،» از هم جدا کنید.
            </DialogDescription>
          </DialogHeader>
          {form && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="کد میز">
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} dir="ltr" />
              </Field>
              <Field label="نام میز">
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="زون">
                <Input value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} />
              </Field>
              <Field label="وضعیت">
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v as DeskForm["status"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DESK_STATUS_LABEL).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="محل میز">
                <Input
                  value={form.locationNote}
                  onChange={(e) => setForm({ ...form, locationNote: e.target.value })}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="امکانات">
                  <Input
                    value={form.features}
                    onChange={(e) => setForm({ ...form, features: e.target.value })}
                    placeholder="صندلی ارگونومیک، پریز برق"
                  />
                </Field>
              </div>
            </div>
          )}
          <DialogFooter className="flex-row-reverse gap-2">
            <Button
              className="rounded-full"
              disabled={save.isPending}
              onClick={() => {
                if (!form) return;
                if (!form.code.trim() || !form.name.trim()) {
                  toast.error("کد و نام میز الزامی است.");
                  return;
                }
                save.mutate(form);
              }}
            >
              ذخیره
            </Button>
            <Button variant="ghost" className="rounded-full" onClick={() => setForm(null)}>
              انصراف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[12px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
