"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { loadDeckById } from "@/lib/persist";
import { flushSave, useDeckStore } from "@/store/deck-store";
import { Stage } from "@/components/canvas/Stage";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { useSidebarStore } from "@/components/sidebar/sidebar-store";
import { DeckNotFound } from "@/components/ui-kit/DeckNotFound";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { Filmstrip } from "./Filmstrip";
import { Toolbar } from "./Toolbar";

type Props = { id: string };

type Status = "loading" | "missing" | "ready";

/** The editor: tool row on top, filmstrip left, stage centre, sidebar right (DESIGN.md §6). */
export function EditorScreen({ id }: Props) {
  const loadDeck = useDeckStore((s) => s.loadDeck);
  const selectSlide = useDeckStore((s) => s.selectSlide);
  const deckLoaded = useDeckStore((s) => s.deck?.id === id);
  const sidebarOpen = useSidebarStore((s) => s.open);
  const [status, setStatus] = useState<Status>("loading");
  // `?slide=<id>` deep-links to a slide (from the review page); honoured once the deck is in the store.
  const requestedSlideId = useSearchParams().get("slide");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // A deck already in memory wins over IndexedDB, which may not have received the autosave yet.
      const inMemory = useDeckStore.getState().deck;
      if (inMemory && inMemory.id === id) {
        setStatus("ready");
        return;
      }
      const deck = await loadDeckById(id);
      if (cancelled) return;
      if (deck) {
        loadDeck(deck);
        setStatus("ready");
      } else {
        setStatus("missing");
      }
    };
    void load();

    return () => {
      cancelled = true;
      void flushSave();
    };
  }, [id, loadDeck]);

  useEffect(() => {
    if (!deckLoaded || !requestedSlideId) return;
    const deck = useDeckStore.getState().deck;
    if (deck?.slides.some((s) => s.id === requestedSlideId)) selectSlide(requestedSlideId);
  }, [deckLoaded, requestedSlideId, selectSlide]);

  if (status === "missing") return <DeckNotFound id={id} />;
  if (status === "loading" || !deckLoaded) return <LoadingState label="Loading deck…" />;

  return (
    <div className="ps-editor">
      <Toolbar />
      <div className="ps-editor-body">
        <Filmstrip />
        <main className="ps-stage-panel">
          <Stage />
        </main>
        {sidebarOpen ? <Sidebar /> : null}
      </div>
    </div>
  );
}
