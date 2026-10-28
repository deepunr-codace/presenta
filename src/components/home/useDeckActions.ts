"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { deckSlug } from "@/components/editor/deck-slug";
import { useToast } from "@/components/shell/Toast";
import { downloadBlob, exportDeckJson, importDeckJson, loadDeckById, saveDeck, trashDeck, type DeckSummary } from "@/lib/persist";
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
      onOpen: (id) => router.push(`/deck/${id}`),
      onEdit: (id) => router.push(`/edit/${id}`),
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
      void run("Importing…", async () => {
        const deck = await importDeckJson(file);
        await saveDeck(deck);
        router.push(`/deck/${deck.id}`);
      });
    },
    [run, router],
  );

  return { actions, busy, error, setError, pendingDelete, setPendingDelete, confirmDelete, importFile };
}
