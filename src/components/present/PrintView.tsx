"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { STAGE_W } from "@/lib/deck/schema";
import { resolveTheme } from "@/lib/deck/themes";
import { SlideRenderer } from "@/components/canvas/SlideRenderer";
import { useDeck } from "./useDeck";

type Props = {
  id: string;
  /** Open the print dialog as soon as fonts and images are ready. */
  auto: boolean;
};

function waitForImages(root: ParentNode): Promise<void> {
  const images = Array.from(root.querySelectorAll("img"));
  return Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) return resolve();
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        }),
    ),
  ).then(() => undefined);
}

/** One 1920 x 1080 sheet per slide for "Save as PDF"; styles live in styles/print.css. */
export function PrintView({ id, auto }: Props) {
  const { deck, status } = useDeck(id);
  const rootRef = useRef<HTMLDivElement>(null);
  const printed = useRef(false);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const measure = () => setZoom(Math.min(1, (window.innerWidth - 48) / STAGE_W));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    if (!auto || !deck || printed.current) return;
    const root = rootRef.current;
    if (!root) return;
    let cancelled = false;
    const fontsReady: Promise<unknown> = typeof document !== "undefined" && "fonts" in document ? document.fonts.ready : Promise.resolve();
    Promise.all([fontsReady, waitForImages(root)]).then(() => {
      if (cancelled || printed.current) return;
      printed.current = true;
      // One extra frame lets late layout (auto-fit measurements) settle before rasterising.
      window.requestAnimationFrame(() => window.print());
    });
    return () => {
      cancelled = true;
    };
  }, [auto, deck]);

  const theme = useMemo(() => (deck ? resolveTheme(deck) : null), [deck]);

  return (
    <>
      <div className="print-bar">
        <button type="button" className="primary" onClick={() => window.print()} disabled={!deck}>
          Print / Save as PDF
        </button>
        <button type="button" onClick={() => window.history.back()}>
          Back
        </button>
        <span className="tip">Choose Save as PDF, margins None, background graphics on.</span>
      </div>
      <div ref={rootRef} className="print-root" style={{ "--print-zoom": String(zoom) } as CSSProperties}>
        {status === "loading" ? <p className="print-note">Loading deck…</p> : null}
        {status === "missing" ? <p className="print-note">Deck not found.</p> : null}
        {deck && theme
          ? deck.slides.map((slide, i) => (
              <div key={slide.id} className="print-sheet" data-page={i + 1}>
                <SlideRenderer slide={slide} theme={theme} scale={1} />
              </div>
            ))
          : null}
      </div>
    </>
  );
}
