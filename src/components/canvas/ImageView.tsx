"use client";

import { Image as ImageIcon } from "@phosphor-icons/react";
import type { ImageElement } from "@/lib/deck/schema";

type Props = { element: ImageElement };

/** Picture with fit, focal point, radius and dark overlay; a dashed placeholder shows the image idea until a source exists. */
export function ImageView({ element }: Props) {
  const radius = element.radius;
  if (!element.src) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: radius,
          border: "2px dashed var(--deck-line)",
          background: "color-mix(in srgb, var(--deck-accent-soft) 45%, transparent)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 32,
          color: "var(--deck-muted)",
          fontFamily: "var(--deck-body)",
          textAlign: "center",
          boxSizing: "border-box",
        }}
      >
        <ImageIcon size={64} weight="thin" color="var(--deck-accent)" />
        {element.query ? <div style={{ fontSize: 22, lineHeight: 1.35, maxWidth: "80%" }}>{element.query}</div> : null}
      </div>
    );
  }
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: radius, overflow: "hidden" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary user/AI sources on a scaled stage */}
      <img src={element.src} alt={element.alt} draggable={false} style={{ width: "100%", height: "100%", objectFit: element.fit, objectPosition: element.position, display: "block" }} />
      {element.overlay > 0 ? <div style={{ position: "absolute", inset: 0, background: `rgba(0,0,0,${element.overlay})` }} /> : null}
    </div>
  );
}
