"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { STAGE_H, STAGE_W, type Slide, type Theme } from "@/lib/deck/schema";
import { cn } from "@/lib/utils";
import { computeAnimationPlan } from "@/lib/deck/animation";
import { ElementView } from "./ElementView";
import { slideTokens } from "@/lib/deck/tokens";
import { backgroundCss } from "./tokens";

export type SlideRendererProps = {
  slide: Slide;
  theme: Theme;
  /** Screen pixels per stage unit. */
  scale: number;
  /** Adds hit-testing attributes and the inline text editor; the Stage owns pointer handling. */
  interactive?: boolean;
  /** Id of the text element currently being edited (interactive only). */
  editingElementId?: string | null;
  onEditingEnd?: () => void;
  className?: string;
  style?: CSSProperties;
  /**
   * Present mode only: how many build steps beyond the slide's entry step are revealed. Omit to show
   * every element at once (editor, thumbnails, review, print) regardless of any animation set on them.
   */
  revealedStep?: number;
};

/**
 * The one renderer for a slide: a 1920 x 1080 box scaled with a CSS transform.
 * Canvas, thumbnails, present and print all go through this component.
 */
export function SlideRenderer({
  slide,
  theme,
  scale,
  interactive = false,
  editingElementId = null,
  onEditingEnd,
  className,
  style,
  revealedStep,
}: SlideRendererProps) {
  const tokens = useMemo(() => slideTokens(theme, slide.background), [theme, slide.background]);
  const elements = useMemo(() => [...slide.elements].sort((a, b) => a.z - b.z), [slide.elements]);
  const bg = slide.background;
  const playback = revealedStep !== undefined;
  const plan = useMemo(() => (playback ? computeAnimationPlan(slide) : null), [playback, slide]);
  // The entry step plays on mount rather than being present instantly: start one step behind, then
  // catch up a frame later so the browser has a "before" state to transition from.
  const [mountStep, setMountStep] = useState(() => (playback ? -1 : Infinity));
  useEffect(() => {
    if (!playback) return;
    const raf = requestAnimationFrame(() => setMountStep(revealedStep!));
    return () => cancelAnimationFrame(raf);
    // Mount-once: subsequent step changes below update immediately, no extra frame needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (playback) setMountStep(revealedStep!);
  }, [playback, revealedStep]);

  const rootStyle: CSSProperties = {
    ...tokens.vars,
    ...style,
    position: "relative",
    width: STAGE_W,
    height: STAGE_H,
    transform: `scale(${scale})`,
    transformOrigin: "top left",
    background: backgroundCss(theme, bg),
    color: "var(--deck-ink)",
    fontFamily: "var(--deck-body)",
    overflow: "hidden",
    flex: "none",
  } as CSSProperties;

  return (
    <div className={cn("deck-stage", tokens.dark && "deck-stage-dark", className)} style={rootStyle} data-slide-id={slide.id}>
      {bg.kind === "image" ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary background sources */}
          <img src={bg.src} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: `rgba(0,0,0,${bg.overlay})` }} />
        </>
      ) : null}
      {elements.map((el) => {
        const anim = plan?.byElement.get(el.id);
        return (
          <ElementView
            key={el.id}
            element={el}
            theme={theme}
            slideId={slide.id}
            interactive={interactive}
            editing={interactive && el.type === "text" && editingElementId === el.id}
            onEditingEnd={onEditingEnd}
            reveal={anim ? { ...anim, visible: anim.groupIndex <= mountStep } : undefined}
          />
        );
      })}
    </div>
  );
}
