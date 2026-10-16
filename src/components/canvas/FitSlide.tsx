"use client";

import { useRef, type ReactNode } from "react";
import { STAGE_W, type Slide, type Theme } from "@/lib/deck/schema";
import { cn } from "@/lib/utils";
import { SlideRenderer } from "./SlideRenderer";
import { useElementWidth } from "./useElementWidth";

type Props = {
  slide: Slide | null | undefined;
  theme: Theme | null | undefined;
  maxWidth?: number;
  className?: string;
  /** Shown inside the 16:9 box while there is nothing to render. */
  fallback?: ReactNode;
};

/**
 * A slide scaled to the width of its 16:9 container (thumbnails, previews, the review hero).
 * The renderer is absolutely positioned: its 1920 px box must not contribute to the intrinsic
 * width of auto-sized ancestors (grid tracks, flex items), only the 16:9 box does.
 */
export function FitSlide({ slide, theme, maxWidth, className, fallback }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(boxRef);
  return (
    <div ref={boxRef} className={cn("relative aspect-video w-full overflow-hidden", className)} style={{ maxWidth }}>
      {slide && theme && width > 0 ? <SlideRenderer slide={slide} theme={theme} scale={width / STAGE_W} className="absolute top-0 left-0" /> : fallback}
    </div>
  );
}
