import type { Deck, Theme } from "@/lib/deck/schema";
import { openPrintView } from "@/lib/export/pdf";
import { exportPptx } from "@/lib/export/pptx";
import { downloadBlob, exportDeckJson } from "@/lib/persist";
import { flushSave } from "@/store/deck-store";
import { deckSlug } from "./deck-slug";

export type ExportKind = "pdf" | "pptx" | "json";

/** Export a deck as JSON, PowerPoint or the print view. PDF needs the saved copy, so it flushes autosave first. */
export function exportDeck(deck: Deck, theme: Theme, kind: ExportKind): void {
  if (kind === "json") {
    downloadBlob(exportDeckJson(deck), `${deckSlug(deck.title)}.json`);
  } else if (kind === "pptx") {
    void exportPptx(deck, theme);
  } else {
    void flushSave();
    openPrintView(deck.id);
  }
}
