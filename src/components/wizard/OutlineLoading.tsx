import { StageList } from "@/components/ui-kit/StageList";

const OUTLINE_STAGES = ["Reading brief", "Structuring", "Drafting points"] as const;

type Props = { stage: number };

/** Loading panel for the outline: stage list plus five skeleton rows. */
export function OutlineLoading({ stage }: Props) {
  return (
    <div className="ps-glass" aria-live="polite" aria-busy="true">
      <StageList stages={OUTLINE_STAGES} active={stage} />
      <div className="mt-6 space-y-2" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="ps-tile flex items-center gap-3 p-3">
            <span className="h-3.5 w-5 animate-pulse rounded-[var(--ps-r-pill)] bg-[var(--ps-plate)]" />
            <span className="h-3.5 animate-pulse rounded-[var(--ps-r-pill)] bg-[var(--ps-plate)]" style={{ width: `${44 + ((i * 17) % 30)}%` }} />
            <span className="ml-auto h-3.5 w-20 animate-pulse rounded-[var(--ps-r-pill)] bg-[var(--ps-plate)]" />
          </div>
        ))}
      </div>
    </div>
  );
}
