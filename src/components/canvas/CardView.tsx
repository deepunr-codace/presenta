"use client";

import { createElement, type CSSProperties } from "react";
import type { CardElement, Theme } from "@/lib/deck/schema";
import { CARD_TYPE_SCALE } from "@/lib/deck/layouts";
import { isDarkColor } from "@/lib/deck/tokens";
import { resolveIcon } from "./tokens";

type Props = { element: CardElement; theme: Theme };

type CardPalette = { bg: string; border: string; shadow: string; ink: string; muted: string; accent: string };

function cardPalette(element: CardElement, theme: Theme): CardPalette {
  const c = theme.colors;
  switch (element.variant) {
    case "accent":
      return { bg: c.accent, border: "none", shadow: theme.card.shadow, ink: c.accentInk, muted: "color-mix(in srgb, currentColor 72%, transparent)", accent: c.accentInk };
    case "dark":
      return { bg: isDarkColor(c.bg) ? c.surface : c.ink, border: `1px solid ${c.line}`, shadow: theme.card.shadow, ink: "#FFFFFF", muted: "rgba(255,255,255,0.72)", accent: c.accentSoft };
    case "outline":
      return { bg: "transparent", border: "1.5px solid var(--deck-line)", shadow: "none", ink: "var(--deck-ink)", muted: "var(--deck-muted)", accent: "var(--deck-accent)" };
    case "surface":
    default:
      return { bg: theme.card.fill, border: theme.card.border, shadow: theme.card.shadow, ink: c.ink, muted: c.muted, accent: c.accent };
  }
}

/** Card element: optional icon and index row, big value, title and rich-text body on a themed surface. */
export function CardView({ element, theme }: Props) {
  const p = cardPalette(element, theme);
  const icon = element.icon ? resolveIcon(element.icon) : null;
  const pad = Math.max(24, Math.min(40, Math.round(Math.min(element.w, element.h) * 0.1)));
  const compact = element.h < 260;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        padding: pad,
        borderRadius: theme.card.radius,
        background: p.bg,
        border: p.border,
        boxShadow: p.shadow,
        color: p.ink,
        display: "flex",
        flexDirection: "column",
        gap: compact ? 8 : 12,
        overflow: "hidden",
        fontFamily: "var(--deck-body)",
        // Bullet markers inside the card follow the card's own accent.
        ...(p.accent.startsWith("var(") ? {} : { ["--deck-accent" as string]: p.accent }),
      } as CSSProperties}
    >
      {(element.index || icon) && (
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: compact ? 2 : 8 }}>
          {icon ? createElement(icon, { size: compact ? 36 : 44, weight: "duotone", color: p.accent }) : null}
          {element.index ? <span style={{ fontFamily: "var(--deck-display)", fontSize: 20, fontWeight: 600, letterSpacing: "0.06em", color: p.accent }}>{element.index}</span> : null}
        </div>
      )}
      {element.value ? (
        <div style={{ fontFamily: "var(--deck-display)", fontSize: CARD_TYPE_SCALE.value, fontWeight: theme.fonts.displayWeight, lineHeight: 1, letterSpacing: "-0.03em", color: element.variant === "surface" ? p.accent : p.ink }}>
          {element.value}
        </div>
      ) : null}
      {element.title ? (
        <div style={{ fontFamily: "var(--deck-display)", fontSize: CARD_TYPE_SCALE.title, fontWeight: Math.max(theme.fonts.displayWeight, 500), lineHeight: 1.2, letterSpacing: "-0.01em" }}>{element.title}</div>
      ) : null}
      {element.body ? (
        <div
          className="deck-text"
          style={{ fontSize: CARD_TYPE_SCALE.body, fontWeight: theme.fonts.bodyWeight, lineHeight: 1.45, color: p.muted, overflow: "hidden", whiteSpace: "pre-line" }}
        >
          {element.body}
        </div>
      ) : null}
    </div>
  );
}
