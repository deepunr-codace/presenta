"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SAMPLE_DECK } from "@/lib/deck/sample";
import { deleteDeckById, downloadBlob, exportDeckJson, importDeckJson, listDecks, loadDeckById, saveDeck, type DeckSummary } from "@/lib/persist";
import { deckSlug } from "@/components/editor/deck-slug";
import { DeckCard } from "@/components/home/DeckCard";
import { DeleteDeckDialog } from "@/components/home/DeleteDeckDialog";
import { EmptyDecksCard } from "@/components/home/EmptyDecksCard";
import { HomeHero } from "@/components/home/HomeHero";
import { LastEditedCard } from "@/components/home/LastEditedCard";
import { StatCard } from "@/components/home/StatCard";
import { StatSkeleton } from "@/components/home/StatSkeleton";
import type { DeckActions } from "@/components/home/deck-actions";
import { cloneDeck, seedWizardForPaste, seedWizardFromPrompt } from "@/components/home/home-data";
import { ALT_STARTS, type Intent } from "@/components/home/starters";
import { useDayPart } from "@/components/home/useDayPart";
import { AppShell } from "@/components/shell/AppShell";
import { useToast } from "@/components/shell/Toast";
import { ErrorNotice } from "@/components/ui-kit/ErrorNotice";
import { PillTabs } from "@/components/ui-kit/PillTabs";
import { SectionTitle } from "@/components/ui-kit/SectionTitle";

const SORTS = [
  { id: "recent", label: "Recent" },
  { id: "name", label: "A–Z" },
];

export default function HomePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [decks, setDecks] = useState<DeckSummary[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DeckSummary | null>(null);
  const [sort, setSort] = useState("recent");
  const part = useDayPart();
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      setDecks(await listDecks());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read saved decks.");
      setDecks([]);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    listDecks()
      .then((list) => {
        if (alive) setDecks(list);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Could not read saved decks.");
        setDecks([]);
      });
    return () => {
      alive = false;
    };
  }, []);

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

  const openDeck = useCallback((id: string) => router.push(`/deck/${id}`), [router]);
  const editDeck = useCallback((id: string) => router.push(`/edit/${id}`), [router]);

  const openSample = () =>
    run("Opening sample…", async () => {
      const deck = cloneDeck(SAMPLE_DECK);
      await saveDeck(deck);
      openDeck(deck.id);
    });

  const onImportFile = (file: File | undefined) => {
    if (!file) return;
    void run("Importing…", async () => {
      const deck = await importDeckJson(file);
      await saveDeck(deck);
      openDeck(deck.id);
    });
  };

  const duplicate = (id: string) =>
    run("Duplicating…", async () => {
      const deck = await loadDeckById(id);
      if (!deck) throw new Error("That deck could not be loaded.");
      await saveDeck(cloneDeck(deck, `${deck.title} (copy)`));
      await refresh();
      toast("Deck duplicated.", { tone: "success" });
    });

  const exportJson = (id: string) =>
    run("Exporting…", async () => {
      const deck = await loadDeckById(id);
      if (!deck) throw new Error("That deck could not be loaded.");
      downloadBlob(exportDeckJson(deck), `${deckSlug(deck.title)}.json`);
    });

  const confirmDelete = () => {
    const target = pendingDelete;
    if (!target) return;
    setPendingDelete(null);
    void run("Deleting…", async () => {
      await deleteDeckById(target.id);
      await refresh();
      toast("Deck deleted.");
    });
  };

  const startFromPrompt = (text: string) => {
    seedWizardFromPrompt(text);
    router.push("/new");
  };

  const onIntent = (intent: Intent) => {
    if (intent === "paste") {
      seedWizardForPaste();
      router.push("/new");
    } else if (intent === "import") {
      fileRef.current?.click();
    } else if (intent === "sample") {
      void openSample();
    }
  };

  const actions: DeckActions = { onOpen: openDeck, onEdit: editDeck, onDuplicate: (id) => void duplicate(id), onExport: (id) => void exportJson(id), onDelete: setPendingDelete };

  const stats = useMemo(() => {
    const list = decks ?? [];
    return { decks: list.length, slides: list.reduce((sum, d) => sum + d.slideCount, 0) };
  }, [decks]);

  const sorted = useMemo(() => {
    const list = decks ?? [];
    if (sort !== "name") return list;
    return [...list].sort((a, b) => (a.title || "Untitled deck").localeCompare(b.title || "Untitled deck"));
  }, [decks, sort]);

  const hasDecks = Boolean(decks?.length);
  const loading = decks === null;

  return (
    <AppShell active="home" banner>
      <div className="ps-page">
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-hidden
            tabIndex={-1}
            onChange={(e) => {
              onImportFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />

          <header className="mb-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div className="min-w-0">
              <h1 className="ps-heading">What are we building today?</h1>
              <p className="ps-body-lg mt-2">Good {part ?? "day"}. Describe a deck to start one, or pick up a recent deck below.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {ALT_STARTS.map((a) => (
                <button key={a.id} type="button" className="ps-btn" onClick={() => onIntent(a.id)} disabled={busy !== null}>
                  {a.icon}
                  {a.label}
                </button>
              ))}
            </div>
          </header>

          <HomeHero status={busy ?? "Presenta can make mistakes. Review important details."} busy={busy !== null} onSubmit={startFromPrompt} />

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {loading ? (
              <>
                <StatSkeleton />
                <StatSkeleton />
                <StatSkeleton />
              </>
            ) : (
              <>
                <StatCard title="Decks" value={stats.decks.toLocaleString()} unit={stats.decks === 1 ? "deck" : "decks"} caption="Saved in this browser" />
                <StatCard title="Slides" value={stats.slides.toLocaleString()} unit={stats.slides === 1 ? "slide" : "slides"} caption={hasDecks ? `Across ${stats.decks} deck${stats.decks === 1 ? "" : "s"}` : "Nothing generated yet"} />
                <LastEditedCard summary={decks?.[0] ?? null} />
              </>
            )}
          </div>

          {error ? <ErrorNotice compact className="mt-4" message={error} /> : null}

          <section id="decks" className="mt-12 scroll-mt-6" aria-labelledby="recent-decks-title">
            <SectionTitle
              title={<span id="recent-decks-title">Recent decks</span>}
              caption={loading ? undefined : hasDecks ? `${decks?.length} deck${decks?.length === 1 ? "" : "s"} · export JSON to move one elsewhere` : undefined}
              action={hasDecks ? <PillTabs variant="segmented" items={SORTS} value={sort} onChange={setSort} ariaLabel="Sort decks" /> : null}
              className="mb-5"
            />
            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-hidden>
                <StatSkeleton />
                <StatSkeleton />
                <StatSkeleton />
              </div>
            ) : hasDecks ? (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-label="Recent decks">
                {sorted.map((d) => (
                  <DeckCard key={d.id} summary={d} actions={actions} />
                ))}
              </ul>
            ) : (
              <EmptyDecksCard onSample={() => void openSample()} busy={busy !== null} />
            )}
          </section>
        </div>
      </div>

      <DeleteDeckDialog deck={pendingDelete} onCancel={() => setPendingDelete(null)} onConfirm={confirmDelete} />
    </AppShell>
  );
}
