import { formatBytes } from "@/lib/media";
import { cn } from "@/lib/utils";

type Props = {
  used: number;
  limit: number;
  /** One line with a thin bar, for page headers. */
  compact?: boolean;
  className?: string;
};

/** How full the storage is, as a bar and a sentence. Turns amber at 75% and red at 90%. */
export function StorageMeter({ used, limit, compact = false, className }: Props) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const tone = pct >= 90 ? "var(--ps-danger)" : pct >= 75 ? "var(--ps-warning)" : "var(--ps-ink)";
  const label = `${formatBytes(used)} of ${formatBytes(limit)} used`;
  return (
    <div className={cn(compact ? "flex items-center gap-2" : "flex flex-col gap-2", className)}>
      <div
        className={cn("overflow-hidden rounded-full bg-[var(--ps-plate)]", compact ? "h-1.5 w-24" : "h-2 w-full")}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.min(used, limit)}
        aria-label="Storage used"
      >
        <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${Math.max(pct, used > 0 ? 1.5 : 0)}%`, background: tone }} />
      </div>
      <span className={cn("ps-caption", pct >= 90 && "font-medium")} style={pct >= 90 ? { color: "var(--ps-danger)" } : undefined}>
        {label}
        {pct >= 90 ? ". Almost full." : ""}
      </span>
    </div>
  );
}
