import { CircleNotch } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type Props = {
  label?: string;
  className?: string;
};

/** Centred spinner and label for a loading screen or panel. */
export function LoadingState({ label = "Loading…", className }: Props) {
  return (
    <div className={cn("flex h-full min-h-[240px] items-center justify-center gap-2 p-6 text-[13px] text-[var(--ps-smoke)]", className)} aria-busy="true" aria-live="polite">
      <CircleNotch size={16} className="animate-spin" aria-hidden />
      {label}
    </div>
  );
}
