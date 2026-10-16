import { GlassCard } from "@/components/ui-kit/GlassCard";

/** Pulsing placeholder for a stat tile while the deck index loads. */
export function StatSkeleton() {
  return (
    <GlassCard aria-hidden>
      <div className="h-3 w-16 animate-pulse rounded-[var(--ps-r-pill)] bg-[var(--ps-plate)]" />
      <div className="mt-5 h-8 w-24 animate-pulse rounded-[var(--ps-r-pill)] bg-[var(--ps-plate)]" />
      <div className="mt-3 h-3 w-28 animate-pulse rounded-[var(--ps-r-pill)] bg-[var(--ps-plate)]" />
    </GlassCard>
  );
}
