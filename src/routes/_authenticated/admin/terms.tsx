import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getTermsSettings, updateTermsSettings } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/admin/terms")({
  head: () => ({ meta: [{ title: "قوانین — آغاز" }, { name: "robots", content: "noindex" }] }),
  component: AdminTerms,
});

function AdminTerms() {
  const qc = useQueryClient();
  const fetchTerms = useServerFn(getTermsSettings);
  const saveTerms = useServerFn(updateTermsSettings);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-terms"],
    queryFn: () => fetchTerms(),
    retry: 1,
  });
  const [content, setContent] = useState("");
  const [requireReconsent, setRequireReconsent] = useState(false);
  const [initialized, setInitialized] = useState(false);
  if (data && !initialized) {
    setContent(data.content ?? "");
    setRequireReconsent(!!data.requireReconsent);
    setInitialized(true);
  }
  const m = useMutation({
    mutationFn: () => saveTerms({ data: { content: content.trim(), requireReconsent } }),
    onSuccess: () => {
      toast.success("قوانین ذخیره شد");
      void qc.invalidateQueries({ queryKey: ["admin-terms"] });
      void qc.invalidateQueries({ queryKey: ["public-terms"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (isLoading)
    return <div className="py-16 text-center text-sm text-muted-foreground">در حال بارگذاری…</div>;
  const hasChange = data
    ? content.trim() !== (data.content ?? "") || requireReconsent !== !!data.requireReconsent
    : content.trim().length > 0;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">قوانین و شرایط استفاده</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          نسخه فعلی: {data?.version ?? 0}{" "}
          {data?.updatedAt ? `— ${new Date(data.updatedAt).toLocaleString("fa-IR")}` : ""}
        </p>
      </div>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={14}
        placeholder="متن قوانین را اینجا بنویسید..."
        className="min-h-[320px] leading-7"
      />
      <div className="flex items-center gap-2">
        <Checkbox
          id="req"
          checked={requireReconsent}
          onCheckedChange={(v) => setRequireReconsent(v === true)}
        />
        <label htmlFor="req" className="text-sm">
          نیاز به تأیید مجدد کاربران (کاربران قبلی باید نسخه جدید را بپذیرند)
        </label>
      </div>
      <p className="text-xs text-muted-foreground">{content.trim().length} / 20000 کاراکتر</p>
      <Button
        onClick={() => m.mutate()}
        disabled={!hasChange || m.isPending || content.trim().length > 20000}
        className="rounded-full"
      >
        {m.isPending ? "در حال ذخیره…" : "ذخیره"}
      </Button>
    </div>
  );
}
