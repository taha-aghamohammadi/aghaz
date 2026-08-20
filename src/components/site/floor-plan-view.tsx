import { Check } from "lucide-react";
import type { PublicDesk } from "@/lib/booking.functions";
import { DESK_DISPLAY_META } from "@/components/site/desk-display-meta";
import { toFa } from "@/lib/fa-format";
import { cn } from "@/lib/utils";

type PlanViewProps = {
  desks: PublicDesk[];
  labels: Record<PublicDesk["displayStatus"], string>;
  selectedId?: string | null;
  onSelect: (d: PublicDesk) => void;
};

const ZONE_ORDER: {
  key: string;
  label: string;
  region: "terrace" | "quiet" | "open" | "window";
}[] = [
  { key: "تراس", label: "تراس", region: "terrace" },
  { key: "زون سکوت", label: "زون سکوت", region: "quiet" },
  { key: "فضای باز", label: "فضای باز", region: "open" },
  { key: "کنار پنجره", label: "کنار پنجره", region: "window" },
];

function DeskBlock({
  desk,
  labels,
  selected,
  onSelect,
}: {
  desk: PublicDesk;
  labels: PlanViewProps["labels"];
  selected: boolean;
  onSelect: (d: PublicDesk) => void;
}) {
  const meta = DESK_DISPLAY_META[desk.displayStatus];
  const isFree = desk.displayStatus === "free";
  return (
    <button
      type="button"
      onClick={() => onSelect(desk)}
      className={cn(
        "group relative flex flex-col items-center justify-center gap-1 rounded-xl border px-2 py-3 text-center transition",
        meta.cell,
        !isFree && "opacity-75",
        selected && "ring-2 ring-primary ring-offset-1 ring-offset-card",
      )}
    >
      <span dir="ltr" className="text-[12px] font-semibold">
        {desk.code}
      </span>
      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
        {isFree ? (
          <span className="inline-flex items-center gap-0.5 text-success">
            <Check className="h-3 w-3" />
            {labels.free}
          </span>
        ) : (
          labels[desk.displayStatus]
        )}
      </span>
    </button>
  );
}

export function FloorPlanView({ desks, labels, selectedId, onSelect }: PlanViewProps) {
  const zones = ZONE_ORDER.map((z) => ({
    ...z,
    desks: desks.filter((d) => d.zone === z.key),
  })).filter((z) => z.desks.length > 0);
  const others = desks.filter((d) => !ZONE_ORDER.some((z) => z.key === d.zone));

  const renderZone = (z: (typeof zones)[number], className?: string, cols?: string) => (
    <div className={cn("rounded-2xl border border-hairline bg-background/60 p-3", className)}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-medium text-muted-foreground">{z.label}</span>
        <span className="text-[10px] text-muted-foreground/60">{toFa(z.desks.length)} میز</span>
      </div>
      <div className={cn("grid gap-2", cols ?? "grid-cols-3 sm:grid-cols-4")}>
        {z.desks.map((d) => (
          <DeskBlock
            key={d.id}
            desk={d}
            labels={labels}
            selected={selectedId === d.id}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );

  const terrace = zones.find((z) => z.region === "terrace");
  const side = zones.filter((z) => z.region !== "terrace");

  return (
    <div className="space-y-3">
      {terrace && renderZone(terrace, "border-success/20", "grid-cols-3 sm:grid-cols-5")}
      <div className="grid gap-3 lg:grid-cols-[1fr_1.4fr_1fr]">
        {side.map((z) => (
          <div key={z.key}>{renderZone(z)}</div>
        ))}
      </div>
      {others.length > 0 && (
        <div className="rounded-2xl border border-dashed border-hairline p-3">
          <div className="mb-2 text-[11px] font-medium text-muted-foreground">سایر میزها</div>
          <div className="grid gap-2 grid-cols-3 sm:grid-cols-6">
            {others.map((d) => (
              <DeskBlock
                key={d.id}
                desk={d}
                labels={labels}
                selected={selectedId === d.id}
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
