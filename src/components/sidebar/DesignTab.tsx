"use client";

import { useMemo } from "react";
import { resolveTheme } from "@/lib/deck/themes";
import { useDeckStore, type ElementPatch } from "@/store/deck-store";
import { MultiSelectionProps } from "./MultiSelectionProps";
import { BoxProps } from "./props/BoxProps";
import { CardProps } from "./props/CardProps";
import { ChartProps } from "./props/ChartProps";
import { DeckProps } from "./props/DeckProps";
import { IconProps } from "./props/IconProps";
import { ImageProps } from "./props/ImageProps";
import { MotionProps } from "./props/MotionProps";
import { ShapeProps } from "./props/ShapeProps";
import { SlideProps } from "./props/SlideProps";
import { TextProps } from "./props/TextProps";
import { VideoProps } from "./props/VideoProps";

/** Manual controls: element props when one element is selected, else slide and deck props. */
export function DesignTab() {
  const deck = useDeckStore((s) => s.deck);
  const selectedSlideId = useDeckStore((s) => s.selectedSlideId);
  const selectedElementIds = useDeckStore((s) => s.selectedElementIds);
  const updateElement = useDeckStore((s) => s.updateElement);
  const theme = useMemo(() => (deck ? resolveTheme(deck) : null), [deck]);

  if (!deck || !theme) return null;
  const slide = deck.slides.find((s) => s.id === selectedSlideId) ?? deck.slides[0];
  if (!slide) return null;
  const element = selectedElementIds.length === 1 ? slide.elements.find((e) => e.id === selectedElementIds[0]) : undefined;

  if (element) {
    const patch = (p: ElementPatch) => updateElement(slide.id, element.id, p);
    return (
      <div className="ps-props" key={element.id}>
        <BoxProps slide={slide} element={element} patch={patch} />
        {element.type === "text" ? <TextProps el={element} theme={theme} patch={patch} /> : null}
        {element.type === "image" ? <ImageProps el={element} patch={patch} /> : null}
        {element.type === "card" ? <CardProps el={element} patch={patch} /> : null}
        {element.type === "shape" ? <ShapeProps el={element} theme={theme} patch={patch} /> : null}
        {element.type === "icon" ? <IconProps el={element} theme={theme} patch={patch} /> : null}
        {element.type === "chart" ? <ChartProps el={element} patch={patch} /> : null}
        {element.type === "video" ? <VideoProps element={element} patch={patch} /> : null}
        <MotionProps element={element} patch={patch} />
      </div>
    );
  }

  return (
    <div className="ps-props">
      {selectedElementIds.length > 1 ? <MultiSelectionProps slideId={slide.id} ids={selectedElementIds} /> : null}
      <SlideProps key={slide.id} slide={slide} theme={theme} />
      <DeckProps deck={deck} theme={theme} />
    </div>
  );
}
