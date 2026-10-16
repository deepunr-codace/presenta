"use client";

import type { CSSProperties, ReactNode } from "react";
import type { Element, Theme } from "@/lib/deck/schema";
import { CardView } from "./CardView";
import { ChartView } from "./ChartView";
import { EditableText } from "./EditableText";
import { IconView } from "./IconView";
import { ImageView } from "./ImageView";
import { ShapeView } from "./ShapeView";
import { TextView } from "./TextView";

export type ElementViewProps = {
  element: Element;
  theme: Theme;
  slideId: string;
  /** Adds data attributes used by the Stage for hit-testing and selection. */
  interactive?: boolean;
  /** When true (text only) the element renders the inline editor. */
  editing?: boolean;
  /** Called by the inline editor when it exits. */
  onEditingEnd?: () => void;
};

/** Positions one element on the 1920 x 1080 stage and picks the view for its type. */
export function ElementView({ element, theme, slideId, interactive = false, editing = false, onEditingEnd }: ElementViewProps) {
  const frame: CSSProperties = {
    position: "absolute",
    left: element.x,
    top: element.y,
    width: element.w,
    height: element.h,
    transform: `rotate(${element.rotation}deg)`,
    transformOrigin: "center center",
    zIndex: element.z,
    opacity: element.opacity,
    boxSizing: "border-box",
  };

  let content: ReactNode;
  switch (element.type) {
    case "text":
      content = editing ? <EditableText element={element} theme={theme} slideId={slideId} onExit={onEditingEnd} /> : <TextView element={element} theme={theme} />;
      break;
    case "image":
      content = <ImageView element={element} />;
      break;
    case "shape":
      content = <ShapeView element={element} />;
      break;
    case "card":
      content = <CardView element={element} theme={theme} />;
      break;
    case "icon":
      content = <IconView element={element} />;
      break;
    case "chart":
      content = <ChartView element={element} />;
      break;
  }

  return (
    <div
      className="deck-element"
      style={frame}
      data-element-id={interactive ? element.id : undefined}
      data-element-type={interactive ? element.type : undefined}
      data-locked={interactive && element.locked ? "true" : undefined}
      data-editing={editing ? "true" : undefined}
    >
      {content}
    </div>
  );
}
