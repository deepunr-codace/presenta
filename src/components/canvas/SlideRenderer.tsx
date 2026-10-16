"use client";

import { useMemo, type CSSProperties } from "react";
import { STAGE_H, STAGE_W, type Slide, type Theme } from "@/lib/deck/schema";
import { cn } from "@/lib/utils";
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
}: SlideRendererProps) {
  const tokens = useMemo(() => slideTokens(theme, slide.background), [theme, slide.background]);
  const elements = useMemo(() => [...slide.elements].sort((a, b) => a.z - b.z), [slide.elements]);
  const bg = slide.background;

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
      {elements.map((el) => (
        <ElementView
          key={el.id}
          element={el}
          theme={theme}
          slideId={slide.id}
          interactive={interactive}
          editing={interactive && el.type === "text" && editingElementId === el.id}
          onEditingEnd={onEditingEnd}
        />
      ))}
    </div>
  );
}
