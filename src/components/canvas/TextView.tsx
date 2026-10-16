"use client";

import { useMemo, useRef, type CSSProperties } from "react";
import type { TextElement, Theme } from "@/lib/deck/schema";
import { textBaseFontSize, textStyle } from "./tokens";
import { useAutoFit } from "./useAutoFit";

type Props = { element: TextElement; theme: Theme };

const VALIGN: Record<TextElement["valign"], CSSProperties["justifyContent"]> = {
  top: "flex-start",
  middle: "center",
  bottom: "flex-end",
};

/** Static rich text with optional auto-fit; the inline editor shares its typography. */
export function TextView({ element, theme }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const style = useMemo(() => textStyle(element, theme), [element, theme]);
  const base = textBaseFontSize(element);
  useAutoFit(ref, element.autoFit, base, [element.html, element.w, element.h, style.fontWeight, style.lineHeight, style.fontFamily]);
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: VALIGN[element.valign] }}>
      <div ref={ref} className="deck-text" style={{ ...style, width: "100%", maxHeight: "100%", overflow: "hidden", overflowWrap: "break-word" }} dangerouslySetInnerHTML={{ __html: element.html }} />
    </div>
  );
}
