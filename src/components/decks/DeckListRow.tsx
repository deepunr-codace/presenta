"use client";

import type { ReactNode } from "react";
import { FolderSimple, Presentation } from "@phosphor-icons/react";
import { DeckMenu } from "@/components/home/DeckMenu";
import type { DeckActions } from "@/components/home/deck-actions";
import { formatBytes } from "@/lib/media";
import type { DeckSummary } from "@/lib/persist";
import { timeAgo } from "@/lib/time";
import { DECK_DRAG } from "./drag";

type Props = {
  summary: DeckSummary;
  actions: DeckActions;
  /** Where the deck lives, shown when the list is not inside a folder (search, filters). */
  location?: string;
  badge: ReactNode;
};

/** One deck as a table-like row for the list view: name, who it is shared with, where it is, size, age. */
export function DeckListRow({ summary, actions, location, badge }: Props) {
  const title = summary.title || "Untitled deck";
  return (
    <li
      className="grid items-center gap-3 rounded-[var(--ps-r-md)] border border-transparent px-3 py-2 hover:border-[var(--ps-line)] hover:bg-[var(--ps-plate)] md:grid-cols-[minmax(0,2.4fr)_minmax(0,1.4fr)_minmax(0,1.2fr)_80px_80px_90px_32px]"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DECK_DRAG, summary.id);
        e.dataTransfer.effectAllowed = "move";
      }}
    >
      <button type="button" className="flex min-w-0 items-center gap-2 text-left" onClick={() => actions.onOpen(summary.id, summary.slug)}>
        <Presentation size={18} weight="light" className="shrink-0 text-[var(--ps-ink)]" aria-hidden />
        <span className="truncate text-[14px] font-medium text-[var(--ps-ink)]">{title}</span>
      </button>
      <span className="hidden md:block">{badge}</span>
      <span className="ps-caption hidden items-center gap-1 truncate md:flex">
        {location ? (
          <>
            <FolderSimple size={12} aria-hidden /> <span className="truncate">{location}</span>
          </>
        ) : (
          "—"
        )}
      </span>
      <span className="ps-caption hidden md:block">{summary.slideCount} slides</span>
      <span className="ps-caption hidden md:block">{summary.sizeBytes ? formatBytes(summary.sizeBytes) : "—"}</span>
      <span className="ps-caption hidden md:block">{timeAgo(summary.updatedAt)}</span>
      <DeckMenu summary={summary} actions={actions} />
    </li>
  );
}
