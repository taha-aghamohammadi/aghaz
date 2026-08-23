import { useEffect, useState } from "react";
import { getMyTermsStatus, acceptTerms } from "@/lib/terms.functions";
import { needsReconsent, shouldShowBanner } from "@/lib/terms.service";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export function TermsGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{
    terms: { content: string; version: number; requireReconsent: boolean };
    acceptedVersion: number | null;
  } | null>(null);
  const [open, setOpen] = useState(false);
  const [banner, setBanner] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getMyTermsStatus()
      .then((s) => {
        setState(s as never);
        if (needsReconsent(s.acceptedVersion, s.terms as never)) setOpen(true);
        else if (shouldShowBanner(s.acceptedVersion, s.terms as never)) {
          const dismissed = Number(localStorage.getItem("dismissedTermsVersion") ?? -1);
          if (dismissed !== s.terms.version) setBanner(true);
        }
      })
      .catch(() => {});
  }, []);

  const accept = async () => {
    if (!state) return;
    setSaving(true);
    try {
      await acceptTerms({ data: { version: state.terms.version } });
      setOpen(false);
      setBanner(false);
      localStorage.setItem("dismissedTermsVersion", String(state.terms.version));
      toast.success("قوانین تأیید شد");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    } finally {
      setSaving(false);
    }
  };

  const dismissBanner = () => {
    if (!state) return;
    localStorage.setItem("dismissedTermsVersion", String(state.terms.version));
    setBanner(false);
  };

  return (
    <>
      {banner && state && (
        <div className="flex items-center justify-between gap-4 border-b border-warning/30 bg-warning/10 px-4 py-3 text-sm">
          <span>
            قوانین به‌روزرسانی شده —{" "}
            <button onClick={() => setOpen(true)} className="text-primary underline">
              مطالعه کنید
            </button>
          </span>
          <Button variant="ghost" size="sm" onClick={dismissBanner} className="h-7 rounded-full">
            بستن
          </Button>
        </div>
      )}
      <Dialog open={open} onOpenChange={() => {}}>
        <DialogContent
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          className="max-h-[80vh] overflow-y-auto [&>button]:hidden"
        >
          <DialogHeader>
            <DialogTitle>قوانین به‌روزرسانی شده</DialogTitle>
            <DialogDescription>
              برای ادامه استفاده از آغاز، لطفاً قوانین جدید را مطالعه و تأیید کنید.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-xl border border-hairline bg-surface p-4 text-[13.5px] leading-7">
            {state?.terms.content}
          </div>
          <Button onClick={accept} disabled={saving} className="mt-4 w-full rounded-full">
            {saving ? "…" : "می‌پذیرم"}
          </Button>
        </DialogContent>
      </Dialog>
      {open ? null : children}
    </>
  );
}
