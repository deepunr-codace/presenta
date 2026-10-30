import type { Deck, Theme } from "@/lib/deck/schema";
import { openPrintView } from "@/lib/export/pdf";
import { exportPptx } from "@/lib/export/pptx";
import { downloadBlob, exportDeckJson } from "@/lib/persist";
import { flushSave } from "@/store/deck-store";
import { deckSlug } from "./deck-slug";

export type ExportKind = "pdf" | "pptx" | "json";

/** Export a deck as JSON, PowerPoint or the print view. PDF needs the saved copy, so it flushes autosave first. */
export async function exportDeck(deck: Deck, theme: Theme, kind: ExportKind): Promise<string[]> {
  if (kind === "json") {
    downloadBlob(exportDeckJson(deck), `${deckSlug(deck.title)}.json`);
    return [];
  } else if (kind === "pptx") {
    return exportPptx(deck, theme);
  } else {
    await flushSave();
    openPrintView(deck.id);
    return [];
  }
}
