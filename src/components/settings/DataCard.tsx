"use client";

import { useRef, useState } from "react";
import { DownloadSimple, UploadSimple } from "@phosphor-icons/react";
import { useToast } from "@/components/shell/Toast";
import type { Deck } from "@/lib/deck/schema";
import { downloadBlob, importDeckJson, listDecks, loadDeckById, saveDeck } from "@/lib/persist";

type Backup = { app: "presenta"; version: 1; exportedAt: string; decks: Deck[] };

/** Take all my decks out as one backup file, and put a backup back. Everything happens in the browser. */
export function DataCard() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setStatus(null);
    }
  };

  const exportAll = () =>
    run(async () => {
      const summaries = await listDecks();
      const decks: Deck[] = [];
      for (const [i, s] of summaries.entries()) {
        setStatus(`Collecting deck ${i + 1} of ${summaries.length}…`);
        const deck = await loadDeckById(s.id);
        if (deck) decks.push(deck);
      }
      const backup: Backup = { app: "presenta", version: 1, exportedAt: new Date().toISOString(), decks };
      downloadBlob(new Blob([JSON.stringify(backup)], { type: "application/json" }), `presenta-backup-${new Date().toISOString().slice(0, 10)}.json`);
      toast(`Backed up ${decks.length} ${decks.length === 1 ? "deck" : "decks"}.`, { tone: "success" });
    });

  const importBackup = (file: File | undefined) =>
    run(async () => {
      if (!file) return;
      let parsed: Partial<Backup>;
      try {
        parsed = JSON.parse(await file.text()) as Partial<Backup>;
      } catch {
        throw new Error("That file is not valid JSON.");
      }
      if (parsed.app !== "presenta" || !Array.isArray(parsed.decks)) throw new Error("That is not a Presenta backup. To add a single deck, use Import on the Decks page.");
      let added = 0;
      for (const [i, d] of parsed.decks.entries()) {
        setStatus(`Restoring deck ${i + 1} of ${parsed.decks.length}…`);
        // Each deck goes through the normal import so it is validated, and gets a new id if one already exists.
        const deck = await importDeckJson(new File([JSON.stringify(d)], "deck.json", { type: "application/json" }));
        await saveDeck(deck);
        added += 1;
      }
      toast(`Restored ${added} ${added === 1 ? "deck" : "decks"}.`, { tone: "success" });
    });

  return (
    <section className="ps-glass h-full" data-paper aria-labelledby="data-title">
      <h2 id="data-title" className="ps-cardtitle">
        Your data
      </h2>
      <p className="ps-caption mt-1">Keep a copy of all your decks in one file, or restore one. Images stay in your media library.</p>
      <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" aria-hidden tabIndex={-1} onChange={(e) => {
          void importBackup(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="ps-btn ps-btn-xs" onClick={() => void exportAll()} disabled={status !== null}>
          <DownloadSimple size={12} /> Download a backup
        </button>
        <button type="button" className="ps-btn ps-btn-xs" onClick={() => fileRef.current?.click()} disabled={status !== null}>
          <UploadSimple size={12} /> Restore a backup
        </button>
      </div>
      {status ? <p className="ps-caption mt-3" role="status">{status}</p> : null}
      {error ? (
        <p className="ps-caption mt-3" role="alert" style={{ color: "var(--ps-danger)" }}>
          {error}
        </p>
      ) : null}
    </section>
  );
}
