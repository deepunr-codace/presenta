"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PencilSimple, Play } from "@phosphor-icons/react";
import { resolveTheme } from "@/lib/deck/themes";
import { flushSave, useDeckStore } from "@/store/deck-store";
import { editHref } from "@/components/review/deck-stats";
import { ExportMenu } from "./ExportMenu";
import { exportDeck } from "./deck-export";

type Props = {
  id: string;
  /** Editor: Present opens a new tab. Review: Present navigates in place and an Edit link is added. */
  mode: "edit" | "review";
};

/** Page actions for the shell's top bar: Export (secondary), Edit (review only) and Present (primary). */
export function DeckActions({ id, mode }: Props) {
  const router = useRouter();
  const deck = useDeckStore((s) => (s.deck?.id === id ? s.deck : null));
  const theme = deck ? resolveTheme(deck) : null;

  const present = () => {
    // Start the write now; present mode loads the deck from IndexedDB.
    void flushSave();
    const href = `/present/${encodeURIComponent(id)}`;
    if (mode === "edit") window.open(href, "_blank", "noopener");
    else router.push(href);
  };

  return (
    <>
      {/* Under 640 px only Present fits beside the breadcrumbs. */}
      <span className="hidden sm:contents">
        <ExportMenu disabled={!deck} onExport={(kind) => deck && theme && exportDeck(deck, theme, kind)} />
        {mode === "review" ? (
          <Link href={editHref(id)} className="ps-btn" title="Open in the editor">
            <PencilSimple size={12} weight="bold" />
            Edit
          </Link>
        ) : null}
      </span>
      <button type="button" className="ps-btn ps-btn-primary" onClick={present} disabled={!deck} title={mode === "edit" ? "Open in presentation mode" : "Present from the first slide"}>
        <Play size={12} weight="fill" />
        Present
      </button>
    </>
  );
}
