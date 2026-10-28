"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { loadDeckWithAccess } from "@/lib/persist";
import { flushSave, useDeckStore } from "@/store/deck-store";
import { Stage } from "@/components/canvas/Stage";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { useSidebarStore } from "@/components/sidebar/sidebar-store";
import { DeckNotFound } from "@/components/ui-kit/DeckNotFound";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { EditLockDialogs } from "./EditLockDialogs";
import { Filmstrip } from "./Filmstrip";
import { Toolbar } from "./Toolbar";
import { useEditLock } from "./useEditLock";

type Props = { id: string };

type Status = "loading" | "missing" | "ready";

/**
 * The editor: tool row on top, filmstrip left, stage centre, sidebar right (DESIGN.md §6). Only one person edits a deck
 * at a time: the canvas appears once this tab holds the edit lock, and viewers are sent to the read-only review page.
 */
export function EditorScreen({ id }: Props) {
  const router = useRouter();
  const loadDeck = useDeckStore((s) => s.loadDeck);
  const selectSlide = useDeckStore((s) => s.selectSlide);
  const deckLoaded = useDeckStore((s) => s.deck?.id === id);
  const sidebarOpen = useSidebarStore((s) => s.open);
  const [status, setStatus] = useState<Status>("loading");
  const [viewer, setViewer] = useState(false);
  // `?slide=<id>` deep-links to a slide (from the review page); honoured once the deck is in the store.
  const requestedSlideId = useSearchParams().get("slide");

  const canEdit = status === "ready" && deckLoaded && !viewer;
  const lock = useEditLock(id, canEdit);
  const reviewHref = `/deck/${encodeURIComponent(id)}`;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // A deck already in memory wins over the server's copy, which may not have received the autosave yet.
      const inMemory = useDeckStore.getState().deck;
      if (inMemory && inMemory.id === id) {
        setStatus("ready");
        return;
      }
      const loaded = await loadDeckWithAccess(id);
      if (cancelled) return;
      if (!loaded) {
        setStatus("missing");
        return;
      }
      if (loaded.role === "viewer") {
        setViewer(true);
        router.replace(reviewHref);
        return;
      }
      loadDeck(loaded.deck);
      setStatus("ready");
    };
    void load();

    return () => {
      cancelled = true;
      void flushSave();
    };
  }, [id, loadDeck, router, reviewHref]);

  // The server can also tell us we may only view (for example access was changed while the page was open).
  useEffect(() => {
    if (lock.phase.kind === "readonly") router.replace(reviewHref);
  }, [lock.phase.kind, router, reviewHref]);

  useEffect(() => {
    if (!deckLoaded || !requestedSlideId) return;
    const deck = useDeckStore.getState().deck;
    if (deck?.slides.some((s) => s.id === requestedSlideId)) selectSlide(requestedSlideId);
  }, [deckLoaded, requestedSlideId, selectSlide]);

  if (status === "missing") return <DeckNotFound id={id} />;
  if (viewer || lock.phase.kind === "readonly") return <LoadingState label="Opening the deck for viewing…" />;
  if (status === "loading" || !deckLoaded) return <LoadingState label="Loading deck…" />;

  const dialogs = (
    <EditLockDialogs phase={lock.phase} incoming={lock.incoming} onRequestEdit={() => void lock.requestEdit()} onCancelRequest={lock.cancelRequest} onRespond={(allow) => void lock.respond(allow)} onViewOnly={() => router.replace(reviewHref)} />
  );

  // The canvas only appears while this tab holds the lock; otherwise the prompt says why and what to do.
  if (lock.phase.kind !== "editing") {
    return (
      <>
        <LoadingState label={lock.phase.kind === "checking" ? "Checking who is editing…" : "This deck is being edited…"} />
        {dialogs}
      </>
    );
  }

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
      {dialogs}
    </div>
  );
}
