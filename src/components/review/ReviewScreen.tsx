"use client";

import { useCallback, useEffect, useMemo } from "react";
import { Clock, SidebarSimple, Stack, TextAa } from "@phosphor-icons/react";
import { resolveTheme } from "@/lib/deck/themes";
import { useDeckEvent } from "@/hooks/useDeckEvent";
import { timeAgo } from "@/lib/time";
import { flushSave, useDeckStore } from "@/store/deck-store";
import { DeckActions } from "@/components/editor/DeckActions";
import { ThemeSwatch } from "@/components/editor/ThemeSwatch";
import { useDeck } from "@/components/present/useDeck";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { useSidebarStore } from "@/components/sidebar/sidebar-store";
import { DeckNotFound } from "@/components/ui-kit/DeckNotFound";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { SectionTitle } from "@/components/ui-kit/SectionTitle";
import { DeckDetails } from "./DeckDetails";
import { ReviewHero } from "./ReviewHero";
import { ReviewStatCard } from "./ReviewStatCard";
import { SlideThumb } from "./SlideThumb";
import { WORDS_PER_MINUTE, deckWordCount, editHref, readingMinutes } from "./deck-stats";

type Props = { id: string };

/**
 * Review page (DESIGN.md §6): title row (name, meta, Export / Edit / Present), hero slide in a paper
 * card, three stat tiles, the "All slides" grid and the right sidebar (Assistant at deck scope,
 * Details). The deck lives in the deck store so assistant edits are undoable and autosaved exactly
 * as in the editor.
 */
export function ReviewScreen({ id }: Props) {
  const { deck: fetched, status } = useDeck(id);
  useDeckEvent(id, "view", status === "ready");
  const loadDeck = useDeckStore((s) => s.loadDeck);
  const deck = useDeckStore((s) => (s.deck?.id === id ? s.deck : null));
  const selectedSlideId = useDeckStore((s) => s.selectedSlideId);
  const selectSlide = useDeckStore((s) => s.selectSlide);
  const theme = useMemo(() => (deck ? resolveTheme(deck) : null), [deck]);
  const words = useMemo(() => (deck ? deckWordCount(deck) : 0), [deck]);
  const count = deck?.slides.length ?? 0;
  const sidebarOpen = useSidebarStore((s) => s.open);
  const setSidebarOpen = useSidebarStore((s) => s.setOpen);

  useEffect(() => {
    if (!fetched) return;
    const current = useDeckStore.getState().deck;
    if (current?.id !== fetched.id) loadDeck(structuredClone(fetched));
    return () => {
      void flushSave();
    };
  }, [fetched, loadDeck]);

  const foundIndex = deck && selectedSlideId ? deck.slides.findIndex((s) => s.id === selectedSlideId) : -1;
  const index = Math.max(0, Math.min(foundIndex, Math.max(0, count - 1)));
  const setIndex = useCallback(
    (i: number) => {
      const slide = useDeckStore.getState().deck?.slides[i];
      if (slide) selectSlide(slide.id);
    },
    [selectSlide],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setIndex(Math.min(count - 1, index + 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setIndex(Math.max(0, index - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count, index, setIndex]);

  if (status === "missing") return <DeckNotFound id={id} />;
  if (!deck || !theme) return <LoadingState label="Loading deck…" />;

  return (
    <div className="ps-review">
      {/* The top bar spans the page and the side panel, as in the editor. */}
      <header className="ps-review-head">
        <div className="min-w-0 flex-1 basis-56">
          <h1 className="ps-review-title">{deck.title || "Untitled deck"}</h1>
          <div className="ps-review-meta">
            <span className="ps-review-meta-theme" title={theme.description}>
              <ThemeSwatch pair={theme.swatch} className="h-3 w-5 rounded-[2px]" />
              {theme.name}
            </span>
            <span aria-hidden>·</span>
            <span>
              {count} slide{count === 1 ? "" : "s"}
            </span>
            <span aria-hidden>·</span>
            <span>updated {timeAgo(deck.updatedAt)}</span>
          </div>
        </div>
        <div className="ps-review-actions">
          <DeckActions id={deck.id} mode="review" />
          <button type="button" className="ps-iconbtn" aria-pressed={sidebarOpen} onClick={() => setSidebarOpen(!sidebarOpen)} title={sidebarOpen ? "Hide the side panel" : "Show the side panel"} aria-label={sidebarOpen ? "Hide the side panel" : "Show the side panel"}>
            <SidebarSimple size={16} mirrored />
          </button>
        </div>
      </header>
      <div className="ps-review-body">
        <main className="ps-review-main">
          <ReviewHero slide={deck.slides[index]} theme={theme} index={index} count={count} onIndexChange={setIndex} />

          <section aria-label="Deck stats" className="ps-review-stats">
            <ReviewStatCard icon={<Stack />} title="Slides" value={String(count)} caption={count === 1 ? "One slide in this deck" : "Slides in this deck"} />
            <ReviewStatCard icon={<TextAa />} title="Words" value={words.toLocaleString()} caption="Visible text across all slides" />
            <ReviewStatCard icon={<Clock />} title="Reading time" value={readingMinutes(words)} unit="min" caption={`At ${WORDS_PER_MINUTE} words per minute`} />
          </section>

          <section aria-label="All slides" className="ps-review-all">
            <SectionTitle title="All slides" caption="Click a slide to preview it" className="mb-3" />
            <div className="ps-review-grid">
              {deck.slides.map((s, i) => (
                <SlideThumb key={s.id} slide={s} theme={theme} index={i} active={i === index} onSelect={() => setIndex(i)} editHref={editHref(deck.id, s.id)} />
              ))}
            </div>
          </section>
        </main>

        {sidebarOpen ? (
          <div className="ps-review-side">
            <Sidebar tabs={["assistant", "details"]} defaultScope="deck" details={<DeckDetails deck={deck} theme={theme} />} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
