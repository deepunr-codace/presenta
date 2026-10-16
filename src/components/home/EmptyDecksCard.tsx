import Link from "next/link";
import { SquaresFour } from "@phosphor-icons/react";
import { GlassCard } from "@/components/ui-kit/GlassCard";
import { IconChip } from "@/components/ui-kit/IconChip";

type Props = { onSample: () => void; busy?: boolean };

/** Empty state for the recent decks grid (DESIGN.md §5): icon plate, 18 px title, one line, a filled pill. */
export function EmptyDecksCard({ onSample, busy = false }: Props) {
  return (
    <GlassCard as="div" className="ps-emptystate" role="status">
      <IconChip icon={<SquaresFour />} />
      <h3 className="ps-title mt-2">No decks yet</h3>
      <p className="ps-body max-w-md">Describe a talk above, paste your notes, import a JSON file or open the sample. Everything stays in this browser.</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Link href="/new" className="ps-btn ps-btn-primary">
          New deck
        </Link>
        <button type="button" className="ps-btn" onClick={onSample} disabled={busy}>
          Open sample
        </button>
      </div>
    </GlassCard>
  );
}
