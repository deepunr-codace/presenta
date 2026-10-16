import type { ReactNode } from "react";
import { GlassCard } from "@/components/ui-kit/GlassCard";
import { Numeral } from "@/components/ui-kit/Numeral";

type Props = {
  title: string;
  value: ReactNode;
  unit?: string;
  caption: string;
  /** Right-aligned element in the label row (a small button). */
  action?: ReactNode;
  className?: string;
};

/** Stat tile (DESIGN.md §5): taupe card with a 13 px label, an Inter 300 value at 32 px with a unit, and a caption. No sparkline. */
export function StatCard({ title, value, unit, caption, action, className }: Props) {
  return (
    <GlassCard as="article" className={className}>
      <div className="mb-4 flex min-h-8 items-center justify-between gap-2">
        <h3 className="ps-label">{title}</h3>
        {action}
      </div>
      <Numeral value={value} unit={unit} caption={caption} />
    </GlassCard>
  );
}
