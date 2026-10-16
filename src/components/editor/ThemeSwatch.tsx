import type { Theme } from "@/lib/deck/schema";
import { cn } from "@/lib/utils";

type Props = { pair: Theme["swatch"]; className?: string };

/** Two-colour swatch for a theme. */
export function ThemeSwatch({ pair, className }: Props) {
  return (
    <span className={cn("flex h-5 w-8 shrink-0 overflow-hidden rounded-[3px] border border-[var(--ps-line-2)]", className)} aria-hidden>
      <span className="flex-1" style={{ background: pair[0] }} />
      <span className="flex-1" style={{ background: pair[1] }} />
    </span>
  );
}
