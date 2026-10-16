"use client";

import type { DeckSummary } from "@/lib/persist";
import { GlassCard } from "@/components/ui-kit/GlassCard";
import { DeckMenu } from "./DeckMenu";
import { DeckMeta } from "./DeckMeta";
import { DeckThumb } from "./DeckThumb";
import type { DeckActions } from "./deck-actions";
import { useStoredDeck } from "./useStoredDeck";

type Props = { summary: DeckSummary; actions: DeckActions };

/** Paper card for one saved deck: thumbnail, title, meta and the actions menu. Clicking the card opens the deck. */
export function DeckCard({ summary, actions }: Props) {
  const deck = useStoredDeck(summary.id);
  const title = summary.title || "Untitled deck";
  return (
    <GlassCard
      as="li"
      onClick={() => actions.onOpen(summary.id)}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          actions.onOpen(summary.id);
        }
      }}
      tabIndex={0}
      role="link"
      aria-label={`Open ${title}`}
      paper
      className="ps-focus gap-3 p-3"
    >
      <DeckThumb deck={deck} />
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[14px] leading-5 font-medium text-[var(--ps-ink)]">{title}</h3>
          <div className="mt-0.5">
            <DeckMeta summary={summary} deck={deck} />
          </div>
        </div>
        <DeckMenu summary={summary} actions={actions} />
      </div>
    </GlassCard>
  );
}
