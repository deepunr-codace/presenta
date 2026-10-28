import { cn } from "@/lib/utils";

type Props = {
  label?: string;
  className?: string;
};

/** Centred animated loader and label for a loading screen or panel. */
export function LoadingState({ label = "Loading…", className }: Props) {
  return (
    <div className={cn("ps-reveal flex h-full min-h-[240px] items-center justify-center gap-3 p-6 text-[13px] text-[var(--ps-smoke)]", className)} aria-busy="true" aria-live="polite" role="status">
      <span className="ps-loader" aria-hidden>
        <span />
        <span />
        <span />
        <span />
      </span>
      {label}
    </div>
  );
}
