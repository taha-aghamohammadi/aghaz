import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteTransaction, listTransactions, saveTransaction } from "@/lib/admin.functions";
import { faDate, faNumber, formatPriceWithCommas, parsePriceAmount, stripPriceDigits, toman } from "@/lib/fa-format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export const Route = createFileRoute("/_authenticated/admin/finance")({
  head: () => ({
    meta: [
      { title: "حسابداری و مالی | آغاز" },
      { name: "description", content: "ثبت درآمد و هزینه، سود خالص و درآمد رزروهای فضای کار اشتراکی آغاز." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "حسابداری و مالی | آغاز" },
      { property: "og:description", content: "درآمد، هزینه و سود خالص فضای کار آغاز." },
    ],
  }),
  component: AdminFinance,
});

const CATEGORIES = {
  income: ["رزرو میز", "اشتراک ماهانه", "رویداد", "سایر درآمد"],
  expense: ["اجاره", "حقوق", "اینترنت و برق", "تجهیزات", "بازاریابی", "سایر هزینه"],
};

function AdminFinance() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"income" | "expense">("expense");
  const [category, setCategory] = useState(CATEGORIES.expense[0]!);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [occurredOn, setOccurredOn] = useState(() => new Date().toISOString().slice(0, 10));

  const fetchTx = useServerFn(listTransactions);
  const createTx = useServerFn(saveTransaction);
  const removeTx = useServerFn(deleteTransaction);

  const { data, isLoading } = useQuery({ queryKey: ["admin-finance"], queryFn: () => fetchTx() });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["admin-finance"] });
    void qc.invalidateQueries({ queryKey: ["admin-overview"] });
  };

  const save = useMutation({
    mutationFn: () =>
      createTx({
        data: {
          kind,
          category,
          amount: parsePriceAmount(amount) ?? 0,
          description: description.trim(),
          occurredOn,
        },
      }),
    onSuccess: () => {
      toast.success("تراکنش ثبت شد");
      setOpen(false);
      setAmount("");
      setDescription("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeTx({ data: { id } }),
    onSuccess: () => {
      toast.success("تراکنش حذف شد");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const s = data?.summary;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="درآمد ثبت‌شده" value={toman(s?.income ?? 0)} />
        <Card label="هزینه‌ها" value={toman(s?.expense ?? 0)} />
        <Card label="سود خالص" value={toman(s?.net ?? 0)} accent />
        <Card
          label="درآمد رزروهای پرداخت‌شده"
          value={toman(s?.bookingRevenue ?? 0)}
          hint={`${faNumber(s?.bookingCount ?? 0)} رزرو`}
        />
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold">دفتر تراکنش‌ها</h2>
        <Button
          className="rounded-full"
          onClick={() => {
            setOpen(true);
            setKind("expense");
            setCategory(CATEGORIES.expense[0]!);
          }}
        >
          <Plus className="ml-1.5 h-4 w-4" />
          تراکنش جدید
        </Button>
      </div>

      {open && (
        <div className="grid gap-4 rounded-2xl border border-hairline p-5 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label className="text-[12px] text-muted-foreground">نوع</Label>
            <Select
              value={kind}
              onValueChange={(v) => {
                const k = v as "income" | "expense";
                setKind(k);
                setCategory(CATEGORIES[k][0]!);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">درآمد</SelectItem>
                <SelectItem value="expense">هزینه</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px] text-muted-foreground">دسته</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES[kind].map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px] text-muted-foreground">مبلغ (تومان)</Label>
            <Input
              value={amount}
              onChange={(e) => setAmount(formatPriceWithCommas(stripPriceDigits(e.target.value)))}
              dir="ltr"
              inputMode="numeric"
              placeholder="0"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px] text-muted-foreground">تاریخ</Label>
            <Input type="date" value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} dir="ltr" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px] text-muted-foreground">توضیح</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5">
            <Button
              className="rounded-full"
              disabled={save.isPending}
              onClick={() => {
                if (!amount || (parsePriceAmount(amount) ?? 0) <= 0) {
                  toast.error("مبلغ را وارد کنید.");
                  return;
                }
                save.mutate();
              }}
            >
              ذخیره تراکنش
            </Button>
            <Button variant="ghost" className="rounded-full" onClick={() => setOpen(false)}>
              انصراف
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : (data?.rows.length ?? 0) === 0 ? (
        <div className="rounded-2xl border border-hairline px-6 py-16 text-center text-[13px] text-muted-foreground">
          هنوز تراکنشی ثبت نشده است.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-hairline">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-right">تاریخ</TableHead>
                <TableHead className="text-right">نوع</TableHead>
                <TableHead className="text-right">دسته</TableHead>
                <TableHead className="text-right">مبلغ</TableHead>
                <TableHead className="text-right">توضیح</TableHead>
                <TableHead className="text-right">عملیات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.rows ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-[12px] text-muted-foreground">{faDate(r.occurred_on)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={r.kind === "income" ? "default" : "secondary"}
                      className="rounded-full text-[11px] font-normal"
                    >
                      {r.kind === "income" ? "درآمد" : "هزینه"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[12.5px]">{r.category}</TableCell>
                  <TableCell className="text-[12.5px]">{toman(r.amount)}</TableCell>
                  <TableCell className="text-[12px] text-muted-foreground">{r.description || "—"}</TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      title="حذف"
                      onClick={() => {
                        if (confirm("این تراکنش حذف شود؟")) remove.mutate(r.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function Card({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-hairline p-5">
      <div className="text-[11.5px] text-muted-foreground">{label}</div>
      <div className={`mt-2 text-[17px] font-semibold tracking-tight ${accent ? "text-primary" : ""}`}>
        {value}
      </div>
      {hint && <div className="mt-1 text-[11.5px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
