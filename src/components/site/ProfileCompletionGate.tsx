import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { updateMyProfile } from "@/lib/auth.functions";
import { normalizeNationalId } from "@/lib/national-id";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

function isIncomplete(p: { full_name?: string; national_id?: string } | null): boolean {
  if (!p) return true;
  const name = (p.full_name ?? "").trim();
  const nid = (p.national_id ?? "").replace(/\D/g, "");
  return name.length < 3 || nid.length !== 10;
}

export function ProfileCompletionGate({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [education, setEducation] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile-completeness"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, national_id, job_title, education, phone")
        .eq("id", userData.user.id)
        .maybeSingle();
      return data as {
        full_name: string;
        national_id: string;
        job_title: string;
        education: string;
        phone: string;
      } | null;
    },
  });

  useEffect(() => {
    if (profile && isIncomplete(profile)) {
      setFullName(profile.full_name ?? "");
      setNationalId(profile.national_id ?? "");
      setJobTitle(profile.job_title ?? "");
      setEducation(profile.education ?? "");
      setOpen(true);
    } else if (profile && !isIncomplete(profile)) {
      setOpen(false);
    }
  }, [profile]);

  const submit = async () => {
    if (fullName.trim().length < 3) {
      toast.error("نام و نام خانوادگی را کامل وارد کنید.");
      return;
    }
    if (!normalizeNationalId(nationalId)) {
      toast.error("کد ملی معتبر نیست.");
      return;
    }
    setSaving(true);
    try {
      await updateMyProfile({
        data: {
          fullName: fullName.trim(),
          nationalId: nationalId.trim(),
          jobTitle: jobTitle.trim(),
          education: education || "",
        },
      });
      toast.success("اطلاعات ذخیره شد");
      await qc.invalidateQueries({ queryKey: ["profile-completeness"] });
      await qc.invalidateQueries({ queryKey: ["profile"] });
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ذخیره ناموفق بود");
    } finally {
      setSaving(false);
    }
  };

  if (profile && isIncomplete(profile)) {
    return (
      <Dialog open={open} onOpenChange={() => {}}>
        <DialogContent
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          className="max-h-[90vh] overflow-y-auto [&>button]:hidden"
        >
          <DialogHeader>
            <DialogTitle>تکمیل ثبت‌نام</DialogTitle>
            <DialogDescription>
              برای ادامه، لطفاً اطلاعات خود را کامل کنید. این اطلاعات برای تأیید هویت لازم است.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>شماره موبایل</Label>
              <Input dir="ltr" readOnly value={profile.phone ?? ""} className="bg-surface" />
            </div>
            <div className="space-y-2">
              <Label>نام و نام خانوادگی</Label>
              <Input
                value={fullName}
                maxLength={80}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="مثلاً سارا محمدی"
              />
            </div>
            <div className="space-y-2">
              <Label>کد ملی</Label>
              <Input
                dir="ltr"
                inputMode="numeric"
                maxLength={10}
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value.replace(/\D/g, ""))}
                placeholder="0123456789"
              />
            </div>
            <div className="space-y-2">
              <Label>شغل</Label>
              <Input
                value={jobTitle}
                maxLength={80}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="مثلاً برنامه‌نویس"
              />
            </div>
            <div className="space-y-2">
              <Label>تحصیلات</Label>
              <select
                value={education}
                onChange={(e) => setEducation(e.target.value)}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">انتخاب کنید</option>
                {["دیپلم", "کاردانی", "کارشناسی", "کارشناسی ارشد", "دکتری", "سایر"].map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={submit} disabled={saving} className="h-11 w-full rounded-full">
              {saving ? "در حال ذخیره…" : "ذخیره و ادامه"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
  return <>{children}</>;
}
