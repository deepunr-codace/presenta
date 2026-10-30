import Link from "next/link";
import { GlassCard } from "@/components/ui-kit/GlassCard";

type Props = { onSample: () => void; busy?: boolean };

/** Empty state for the recent decks grid (DESIGN.md §5): a fan of slide outlines, 18 px title, one line, a filled pill. */
export function EmptyDecksCard({ onSample, busy = false }: Props) {
  return (
    <GlassCard as="div" className="ps-emptystate" role="status">
      <div className="ps-fan" aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <h3 className="ps-title">No decks yet</h3>
      <p className="ps-body max-w-md">Describe a talk above, paste your notes, import a Presenta JSON or PowerPoint file, or open the sample. Your decks are saved to your account.</p>
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
