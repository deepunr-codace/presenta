"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { CaretLeft, CaretRight, X } from "@phosphor-icons/react";
import { STAGE_H, STAGE_W, type Slide } from "@/lib/deck/schema";
import { resolveTheme } from "@/lib/deck/themes";
import { SlideRenderer } from "@/components/canvas/SlideRenderer";
import { PresentNotes } from "./PresentNotes";
import { useDeck } from "./useDeck";

const NOTES_HEIGHT = 220;
const IDLE_MS = 2000;

type Props = { id: string };

function slideImageSources(slide: Slide): string[] {
  const out: string[] = [];
  if (slide.background.kind === "image") out.push(slide.background.src);
  for (const el of slide.elements) if (el.type === "image" && el.src) out.push(el.src);
  return out;
}

function toggleFullscreen(): void {
  if (typeof document === "undefined") return;
  if (document.fullscreenElement) {
    void document.exitFullscreen().catch(() => undefined);
  } else {
    void document.documentElement.requestFullscreen().catch(() => undefined);
  }
}

function leave(): void {
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  window.history.back();
}

/**
 * Fullscreen black presenter: arrows, space and Enter move, N toggles notes, F fullscreen, Escape leaves.
 * The controls (counter, previous/next, exit) show for two seconds on entry and after any keypress or
 * mouse move, then fade; clicking the stage advances.
 */
export function PresentScreen({ id }: Props) {
  const { deck, status } = useDeck(id);
  const theme = useMemo(() => (deck ? resolveTheme(deck) : null), [deck]);
  const count = deck?.slides.length ?? 0;

  const [rawIndex, setIndex] = useState(0);
  // Clamp at render time so a shrinking deck never leaves the index out of range.
  const index = Math.min(rawIndex, Math.max(0, count - 1));
  const [notesOpen, setNotesOpen] = useState(false);
  const [idle, setIdle] = useState(false);
  const [viewport, setViewport] = useState<{ w: number; h: number } | null>(null);
  const idleTimer = useRef<number | null>(null);

  const goTo = useCallback((target: number) => setIndex(() => Math.max(0, Math.min(count - 1, target))), [count]);
  const next = useCallback(() => setIndex((i) => Math.min(count - 1, i + 1)), [count]);
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    const measure = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key) {
        case "ArrowRight":
        case " ":
        case "Enter":
        case "PageDown":
          e.preventDefault();
          next();
          break;
        case "ArrowLeft":
        case "Backspace":
        case "PageUp":
          e.preventDefault();
          prev();
          break;
        case "Home":
          e.preventDefault();
          goTo(0);
          break;
        case "End":
          e.preventDefault();
          goTo(count - 1);
          break;
        case "Escape":
          e.preventDefault();
          leave();
          break;
        case "n":
        case "N":
          e.preventDefault();
          setNotesOpen((v) => !v);
          break;
        case "f":
        case "F":
          e.preventDefault();
          toggleFullscreen();
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, goTo, count]);

  useEffect(() => {
    const arm = () => {
      setIdle(false);
      if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(() => setIdle(true), IDLE_MS);
    };
    arm();
    window.addEventListener("mousemove", arm);
    window.addEventListener("keydown", arm);
    return () => {
      window.removeEventListener("mousemove", arm);
      window.removeEventListener("keydown", arm);
      if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
    };
  }, []);

  /** Control clicks must not fall through to the stage click that advances. */
  const control = (fn: () => void) => (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    fn();
  };

  // Preload the next slide's images so the transition is instant.
  useEffect(() => {
    const upcoming = deck?.slides[index + 1];
    if (!upcoming) return;
    for (const src of slideImageSources(upcoming)) {
      const img = new Image();
      img.src = src;
    }
  }, [deck, index]);

  if (status === "loading" || !viewport) {
    return <div className="ps-present" aria-busy="true" />;
  }
  if (status === "missing" || !deck || !theme) {
    return (
      <div className="ps-present ps-present-missing">
        <div>
          <p className="ps-present-missing-title">Deck not found.</p>
          <button type="button" className="ps-present-btn" onClick={() => window.history.back()}>
            Go back
          </button>
        </div>
      </div>
    );
  }

  const slide = deck.slides[index];
  const availableH = viewport.h - (notesOpen ? NOTES_HEIGHT : 0);
  const scale = Math.max(0.01, Math.min(viewport.w / STAGE_W, availableH / STAGE_H));
  const boxW = Math.round(STAGE_W * scale);
  const boxH = Math.round(STAGE_H * scale);

  return (
    <div className="ps-present" data-idle={idle || undefined} onClick={next} data-present-root>
      <div className="ps-present-stage" style={{ height: availableH }}>
        <div style={{ width: boxW, height: boxH, overflow: "hidden", position: "relative" }}>{slide ? <SlideRenderer key={slide.id} slide={slide} theme={theme} scale={scale} /> : null}</div>
      </div>

      <div className="ps-present-hud" style={{ bottom: (notesOpen ? NOTES_HEIGHT : 0) + 16 }}>
        <span className="ps-present-hud-keys">Esc exit · N notes · F fullscreen</span>
        <button type="button" className="ps-present-ctl" onClick={control(prev)} disabled={index === 0} aria-label="Previous slide" title="Previous slide (←)">
          <CaretLeft size={14} weight="bold" />
        </button>
        <span className="ps-present-hud-count" aria-live="polite">
          {index + 1} / {count}
        </span>
        <button type="button" className="ps-present-ctl" onClick={control(next)} disabled={index >= count - 1} aria-label="Next slide" title="Next slide (→)">
          <CaretRight size={14} weight="bold" />
        </button>
        <span className="ps-present-hud-sep" aria-hidden />
        <button type="button" className="ps-present-ctl" onClick={control(leave)} aria-label="Exit presentation" title="Exit (Esc)">
          <X size={14} weight="bold" />
        </button>
      </div>

      {notesOpen ? <PresentNotes index={index} notes={slide?.notes} /> : null}
    </div>
  );
}
