"use client";

import { askPdfMode } from "@/lib/pdf-mode";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { deckSlug } from "@/components/editor/deck-slug";
import { deckSegment } from "@/lib/deck/links";
import { deckUrlSlug } from "@/lib/deck/slug";
import { useToast } from "@/components/shell/Toast";
import { runTask } from "@/lib/tasks";
import {
  downloadBlob,
  exportDeckJson,
  importDeckFile,
  loadDeckById,
  saveDeck,
  trashDeck,
  type DeckSummary,
} from "@/lib/persist";
import type { DeckActions } from "./deck-actions";
import { cloneDeck } from "./home-data";

/**
 * What a deck card's menu does: open, edit, duplicate, export, move to trash, and importing a JSON file. `refresh`
 * reloads the caller's list after something changes it. Used by the Decks page.
 */
export function useDeckActions(refresh: () => Promise<void>) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DeckSummary | null>(null);

  const run = useCallback(async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }, []);

  const actions = useMemo<DeckActions>(
    () => ({
      onOpen: (id, slug) => router.push(`/deck/${deckSegment(id, slug)}`),
      onEdit: (id, slug) => router.push(`/edit/${deckSegment(id, slug)}`),
      onDuplicate: (id) =>
        void run("Duplicating…", async () => {
          const deck = await loadDeckById(id);
          if (!deck) throw new Error("That deck could not be loaded.");
          await saveDeck(cloneDeck(deck, `${deck.title} (copy)`));
          await refresh();
          toast("Deck duplicated.", { tone: "success" });
        }),
      onExport: (id) =>
        void run("Exporting…", async () => {
          const deck = await loadDeckById(id);
          if (!deck) throw new Error("That deck could not be loaded.");
          downloadBlob(exportDeckJson(deck), `${deckSlug(deck.title)}.json`);
        }),
      onDelete: setPendingDelete,
    }),
    [router, run, refresh, toast],
  );

  const confirmDelete = useCallback(() => {
    const target = pendingDelete;
    if (!target) return;
    setPendingDelete(null);
    void run("Moving to trash…", async () => {
      await trashDeck(target.id);
      await refresh();
      toast("Moved to trash. You can restore it from Trash.");
    });
  }, [pendingDelete, run, refresh, toast]);

  const importFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      // Ask how to convert before anything says "Importing…", so a cancelled dialog leaves no trace.
      void askPdfMode(file).then((mode) => {
        if (!mode) return;
        return run("Importing…", async () => {
          const deck = await runTask(
            `Importing ${file.name}`,
            async (report) => {
              const d = await importDeckFile(file, report, {
                smart: mode === "smart",
              });
              report(99, "Saving to your account…");
              await saveDeck(d);
              return d;
            },
            "Imported. Opening your deck…",
          );
          router.push(`/deck/${deckUrlSlug(deck.title, deck.id)}`);
        });
      });
    },
    [run, router],
  );

  return {
    actions,
    busy,
    error,
    setError,
    pendingDelete,
    setPendingDelete,
    confirmDelete,
    importFile,
  };
}
