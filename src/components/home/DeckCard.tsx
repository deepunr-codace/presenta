"use client";

import type { HTMLAttributes, ReactNode } from "react";
import type { DeckSummary } from "@/lib/persist";
import { GlassCard } from "@/components/ui-kit/GlassCard";
import { DeckMenu } from "./DeckMenu";
import { DeckMeta } from "./DeckMeta";
import { DeckThumb } from "./DeckThumb";
import type { DeckActions } from "./deck-actions";
import { useStoredDeck } from "./useStoredDeck";

type Props = {
  summary: DeckSummary;
  actions: DeckActions;
  /** Shown under the meta line, for example the sharing indicator. */
  extra?: ReactNode;
  /** Passed to the card, for drag and drop. */
  dragProps?: HTMLAttributes<HTMLElement>;
};

/** Paper card for one saved deck: thumbnail, title, meta and the actions menu. Clicking the card opens the deck. */
export function DeckCard({ summary, actions, extra, dragProps }: Props) {
  const deck = useStoredDeck(summary.id);
  const title = summary.title || "Untitled deck";
  return (
    <GlassCard
      as="li"
      onClick={() => actions.onOpen(summary.id, summary.slug)}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          actions.onOpen(summary.id, summary.slug);
        }
      }}
      tabIndex={0}
      role="link"
      aria-label={`Open ${title}`}
      paper
      className="ps-focus gap-3 p-3"
      {...dragProps}
    >
      <DeckThumb deck={deck} />
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[14.5px] leading-5 font-semibold text-[var(--ps-ink)]">{title}</h3>
          <div className="mt-0.5">
            <DeckMeta summary={summary} deck={deck} />
          </div>
          {extra ? <div className="mt-1.5">{extra}</div> : null}
        </div>
        <DeckMenu summary={summary} actions={actions} />
      </div>
    </GlassCard>
  );
}
