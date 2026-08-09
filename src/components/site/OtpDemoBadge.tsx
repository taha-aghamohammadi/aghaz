import { FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { isOtpDemoMode } from "@/lib/demo-mode";

export function OtpDemoBadge({ className }: { className?: string }) {
  if (!isOtpDemoMode()) return null;

  return (
    <Badge
      variant="outline"
      className={`gap-1.5 border-warning/40 bg-warning/10 text-[11px] font-medium text-foreground ${className ?? ""}`}
    >
      <FlaskConical className="h-3 w-3" />
      حالت دمو — پیامک واقعی ارسال نمی‌شود
    </Badge>
  );
}
