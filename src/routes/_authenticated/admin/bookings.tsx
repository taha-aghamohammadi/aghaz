import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CheckCircle2, LogIn, Receipt as ReceiptIcon, Search, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { deleteBooking, listBookings, updateBooking } from "@/lib/admin.functions";
import { listReceipts, reviewReceipt } from "@/lib/receipt.functions";
import {
  BOOKING_STATUS_LABEL,
  BOOKING_TYPE_LABEL,
  PAYMENT_STATUS_LABEL,
  faDateTime,
  faNumber,
  toman,
} from "@/lib/fa-format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin/bookings")({
  head: () => ({
    meta: [
      { title: "مدیریت رزروها | آغاز" },
      {
        name: "description",
        content: "لیست رزروهای میزهای اشتراکی آغاز با امکان تأیید، لغو و چک‌این.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "مدیریت رزروها | آغاز" },
      { property: "og:description", content: "تأیید، لغو و چک‌این رزروهای فضای کار آغاز." },
    ],
  }),
  component: AdminBookings,
});

const FILTERS = [
  { id: "all", label: "همه" },
  { id: "pending", label: "در انتظار" },
  { id: "confirmed", label: "تأییدشده" },
  { id: "done", label: "پایان‌یافته" },
  { id: "cancelled", label: "لغوشده" },
];

function AdminBookings() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const qc = useQueryClient();

  const fetchBookings = useServerFn(listBookings);
  const patchBooking = useServerFn(updateBooking);
  const removeBooking = useServerFn(deleteBooking);
  const fetchReceipts = useServerFn(listReceipts);
  const review = useServerFn(reviewReceipt);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-bookings", query, status],
    queryFn: () => fetchBookings({ data: { search: query, status } }),
  });

  const { data: receipts } = useQuery({
    queryKey: ["admin-receipts"],
    queryFn: () => fetchReceipts(),
  });
  const receiptsByBooking = new Map((receipts ?? []).map((r) => [r.booking_id, r] as const));
  const [receiptBookingId, setReceiptBookingId] = useState<string | null>(null);

  const reviewReceipts = useMutation({
    mutationFn: ({ receiptId, action }: { receiptId: string; action: "approve" | "reject" }) =>
      review({ data: { receiptId, action } }),
    onSuccess: (res) => {
      toast.success(res.action === "approve" ? "رسید تأیید و رزرو نهایی شد" : "رسید رد شد");
      setReceiptBookingId(null);
      refresh();
      void qc.invalidateQueries({ queryKey: ["admin-receipts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["admin-bookings"] });
    void qc.invalidateQueries({ queryKey: ["admin-overview"] });
  };

  const patch = useMutation({
    mutationFn: (input: {
      id: string;
      status?: "pending" | "confirmed" | "cancelled" | "done";
      paymentStatus?: "unpaid" | "paid" | "refunded";
      checkIn?: boolean;
    }) => patchBooking({ data: input }),
    onSuccess: () => {
      toast.success("رزرو به‌روزرسانی شد");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeBooking({ data: { id } }),
    onSuccess: () => {
      toast.success("رزرو حذف شد");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <form
          className="relative flex-1 min-w-[220px]"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(search.trim());
          }}
        >
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جست‌وجوی کد رزرو، نام یا شماره تماس"
            className="rounded-full border-hairline pr-9"
          />
        </form>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatus(f.id)}
              className={`rounded-full border px-3.5 py-1.5 text-[12.5px] transition ${
                status === f.id
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : "border-hairline text-muted-foreground hover:bg-surface"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-72 rounded-2xl" />
      ) : !data || data.length === 0 ? (
        <div className="rounded-2xl border border-hairline px-6 py-16 text-center text-[13px] text-muted-foreground">
          رزروی با این فیلتر پیدا نشد.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-hairline">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-right">کد رزرو</TableHead>
                <TableHead className="text-right">مشتری</TableHead>
                <TableHead className="text-right">نوع</TableHead>
                <TableHead className="text-right">شروع</TableHead>
                <TableHead className="text-right">مدت</TableHead>
                <TableHead className="text-right">مبلغ</TableHead>
                <TableHead className="text-right">وضعیت</TableHead>
                <TableHead className="text-right">پرداخت</TableHead>
                <TableHead className="text-right">عملیات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-mono text-[12.5px]" dir="ltr">
                    {b.code}
                  </TableCell>
                  <TableCell className="text-[12.5px]">
                    <div>{b.full_name || "مهمان"}</div>
                    {b.phone && (
                      <div className="text-[11px] text-muted-foreground" dir="ltr">
                        {b.phone}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-[12.5px]">
                    {BOOKING_TYPE_LABEL[b.booking_type] ?? b.booking_type}
                  </TableCell>
                  <TableCell className="text-[12px] text-muted-foreground">
                    {faDateTime(b.start_at)}
                  </TableCell>
                  <TableCell className="text-[12.5px]">{faNumber(b.units)}</TableCell>
                  <TableCell className="text-[12.5px]">{toman(b.total_amount ?? 0)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        b.status === "cancelled"
                          ? "destructive"
                          : b.status === "pending"
                            ? "secondary"
                            : "default"
                      }
                      className="rounded-full text-[11px] font-normal"
                    >
                      {BOOKING_STATUS_LABEL[b.status] ?? b.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() =>
                        patch.mutate({
                          id: b.id,
                          paymentStatus: b.payment_status === "paid" ? "unpaid" : "paid",
                        })
                      }
                      className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                        b.payment_status === "paid"
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-hairline text-muted-foreground hover:bg-surface"
                      }`}
                    >
                      {PAYMENT_STATUS_LABEL[b.payment_status] ?? b.payment_status}
                    </button>
                    {(() => {
                      const r = receiptsByBooking.get(b.id);
                      if (!r) return null;
                      return (
                        <button
                          type="button"
                          onClick={() => setReceiptBookingId(b.id)}
                          className={`mr-1.5 inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] transition ${
                            r.status === "approved"
                              ? "border-primary/40 bg-primary/10 text-primary"
                              : r.status === "rejected"
                                ? "border-destructive/40 text-destructive"
                                : "border-amber-400/40 bg-amber-400/10 text-amber-600 hover:bg-amber-400/20"
                          }`}
                        >
                          <ReceiptIcon className="h-3 w-3" />
                          {r.status === "pending"
                            ? "رسید در انتظار بررسی"
                            : r.status === "approved"
                              ? "رسید تأییدشده"
                              : "رسید ردشده"}
                        </button>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {b.status !== "confirmed" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          title="تأیید رزرو"
                          className="h-8 w-8"
                          onClick={() => patch.mutate({ id: b.id, status: "confirmed" })}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      )}
                      {b.status !== "cancelled" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          title="لغو رزرو"
                          className="h-8 w-8"
                          onClick={() => patch.mutate({ id: b.id, status: "cancelled" })}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        title={b.checked_in_at ? "لغو چک‌این" : "چک‌این"}
                        className={`h-8 w-8 ${b.checked_in_at ? "text-primary" : ""}`}
                        onClick={() => patch.mutate({ id: b.id, checkIn: !b.checked_in_at })}
                      >
                        <LogIn className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="حذف"
                        className="h-8 w-8 text-destructive"
                        onClick={() => {
                          if (confirm("این رزرو حذف شود؟")) remove.mutate(b.id);
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

      {(() => {
        const receipt = receiptBookingId ? receiptsByBooking.get(receiptBookingId) : null;
        return (
          <Dialog open={!!receipt} onOpenChange={(open) => !open && setReceiptBookingId(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>بررسی رسید پرداخت</DialogTitle>
                <DialogDescription>
                  {receipt?.booking ? (
                    <>
                      <span className="font-mono" dir="ltr">
                        {receipt.booking.code}
                      </span>
                      {" · "}
                      {receipt.booking.full_name || "مهمان"}
                      {" · "}
                      {toman(receipt.booking.total_amount ?? 0)}
                    </>
                  ) : (
                    "تصویر رسید واریز کارت به کارت"
                  )}
                </DialogDescription>
              </DialogHeader>
              {receipt && (
                <img
                  src={receipt.signedUrl || undefined}
                  alt="تصویر رسید"
                  className="max-h-[60vh] w-full rounded-xl border border-hairline bg-surface object-contain"
                />
              )}
              <DialogFooter className="gap-2">
                {receipt?.status === "pending" ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full text-destructive"
                      disabled={reviewReceipts.isPending}
                      onClick={() =>
                        reviewReceipts.mutate({
                          receiptId: receipt.id,
                          action: "reject",
                        })
                      }
                    >
                      رد رسید
                    </Button>
                    <Button
                      size="sm"
                      className="rounded-full"
                      disabled={reviewReceipts.isPending}
                      onClick={() =>
                        reviewReceipts.mutate({
                          receiptId: receipt.id,
                          action: "approve",
                        })
                      }
                    >
                      تأیید و نهایی‌کردن
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => setReceiptBookingId(null)}
                  >
                    بستن
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
}
