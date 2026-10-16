/** Placeholder for a step while the wizard store hydrates from sessionStorage. */
export function StepSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="h-7 w-48 animate-pulse rounded-[var(--ps-r-sm)] bg-[var(--ps-plate)]" />
      <div className="h-4 w-80 animate-pulse rounded-[var(--ps-r-sm)] bg-[var(--ps-plate)]" />
      <div className="ps-glass mt-6 h-[420px] animate-pulse" />
    </div>
  );
}
