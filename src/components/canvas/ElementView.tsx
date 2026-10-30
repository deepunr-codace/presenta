"use client";

import type { CSSProperties, ReactNode } from "react";
import type { AnimationEffect, Element, Theme } from "@/lib/deck/schema";
import { CardView } from "./CardView";
import { ChartView } from "./ChartView";
import { EditableText } from "./EditableText";
import { IconView } from "./IconView";
import { ImageView } from "./ImageView";
import { ShapeView } from "./ShapeView";
import { TextView } from "./TextView";
import { VideoView } from "./VideoView";

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
  /** Present mode only: this element's entrance animation and whether its build step has been reached. */
  reveal?: { effect: AnimationEffect; duration: number; delay: number; visible: boolean };
};

/** The transform each entrance effect starts from, before the element flies/fades/zooms into place. */
function hiddenTransform(effect: AnimationEffect): string {
  switch (effect) {
    case "fly-up":
      return "translateY(36px)";
    case "fly-down":
      return "translateY(-36px)";
    case "fly-left":
      return "translateX(36px)";
    case "fly-right":
      return "translateX(-36px)";
    case "zoom":
      return "scale(0.85)";
    default:
      return "";
  }
}

/** Positions one element on the 1920 x 1080 stage and picks the view for its type. */
export function ElementView({ element, theme, slideId, interactive = false, editing = false, onEditingEnd, reveal }: ElementViewProps) {
  const rotate = `rotate(${element.rotation}deg)`;
  const frame: CSSProperties = {
    position: "absolute",
    left: element.x,
    top: element.y,
    width: element.w,
    height: element.h,
    transform: reveal && !reveal.visible ? `${rotate} ${hiddenTransform(reveal.effect)}`.trim() : rotate,
    transformOrigin: "center center",
    zIndex: element.z,
    opacity: reveal ? (reveal.visible ? element.opacity : 0) : element.opacity,
    boxSizing: "border-box",
  };
  if (reveal) {
    frame.transition = reveal.visible ? `opacity ${reveal.duration}s ease, transform ${reveal.duration}s ease, clip-path ${reveal.duration}s ease` : "none";
    frame.transitionDelay = `${reveal.delay}s`;
    if (reveal.effect === "wipe") frame.clipPath = reveal.visible ? "inset(0 0 0 0)" : "inset(0 100% 0 0)";
    if (!reveal.visible) frame.pointerEvents = "none";
  }

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
    case "video":
      content = <VideoView element={element} interactive={interactive} />;
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
