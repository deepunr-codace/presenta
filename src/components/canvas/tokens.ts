import type { CSSProperties } from "react";
import type { Icon } from "@phosphor-icons/react";
import * as Phosphor from "@phosphor-icons/react";
import type { SlideBackground, TextElement, TextRole, Theme } from "@/lib/deck/schema";
import { TYPE_SCALE } from "@/lib/deck/layouts";

/* ---------- Colour tokens ---------- */

const DISPLAY_ROLES: ReadonlySet<TextRole> = new Set(["title", "subtitle", "heading", "number", "quote"]);

/** Default font size per role; the layout engine's scale is the single source of truth. */
const DEFAULT_TEXT_SIZE: Record<TextRole, number> = TYPE_SCALE;

const LINE_HEIGHT: Record<TextRole, number> = {
  title: 1.05,
  subtitle: 1.3,
  heading: 1.15,
  body: 1.4,
  bullets: 1.4,
  caption: 1.4,
  quote: 1.25,
  number: 1,
  label: 1.3,
};

const LETTER_SPACING: Partial<Record<TextRole, string>> = {
  title: "-0.02em",
  heading: "-0.01em",
  number: "-0.03em",
  label: "0.08em",
};

/** Named fills used by shapes, icons and text styles resolve to slide-level CSS variables. */
const TOKEN_VARS: Record<string, string> = {
  accent: "var(--deck-accent)",
  accentInk: "var(--deck-accent-ink)",
  accentSoft: "var(--deck-accent-soft)",
  ink: "var(--deck-ink)",
  muted: "var(--deck-muted)",
  surface: "var(--deck-surface)",
  surfaceBorder: "var(--deck-surface-border)",
  line: "var(--deck-line)",
  bg: "var(--deck-bg)",
};

export function resolveColor(value: string | undefined, fallback = "var(--deck-ink)"): string {
  if (!value) return fallback;
  return TOKEN_VARS[value] ?? value;
}

/* ---------- Background contrast ---------- */

export function backgroundCss(theme: Theme, background: SlideBackground): string {
  switch (background.kind) {
    case "theme":
      return theme.background[background.variant];
    case "solid":
      return background.color;
    case "gradient":
      return background.css;
    case "image":
      return theme.background.default;
  }
}

/* ---------- Text typography ---------- */

export function textBaseFontSize(el: TextElement): number {
  return el.style.fontSize ?? DEFAULT_TEXT_SIZE[el.role];
}

/** Static typography for a text element; shared by the static view and the inline editor. */
export function textStyle(el: TextElement, theme: Theme): CSSProperties {
  const role = el.role;
  const family = el.style.fontFamily ?? (DISPLAY_ROLES.has(role) ? "display" : "body");
  const defaultWeight =
    role === "label" ? Math.max(theme.fonts.bodyWeight, 500) : family === "display" ? theme.fonts.displayWeight : theme.fonts.bodyWeight;
  const defaultColor = role === "caption" || role === "label" ? "var(--deck-muted)" : role === "number" ? "var(--deck-accent)" : "var(--deck-ink)";
  return {
    fontFamily: family === "display" ? "var(--deck-display)" : "var(--deck-body)",
    fontSize: textBaseFontSize(el),
    fontWeight: el.style.fontWeight ?? defaultWeight,
    color: el.style.color ? resolveColor(el.style.color) : defaultColor,
    lineHeight: el.style.lineHeight ?? LINE_HEIGHT[role],
    letterSpacing: el.style.letterSpacing !== undefined ? `${el.style.letterSpacing}em` : LETTER_SPACING[role],
    textTransform: role === "label" ? "uppercase" : undefined,
    textAlign: el.align,
  };
}

/* ---------- Icons ---------- */

const ICONS = Phosphor as unknown as Record<string, unknown>;

function isIcon(v: unknown): v is Icon {
  return typeof v === "object" && v !== null && "$$typeof" in v && "render" in v;
}

/** Phosphor icon by export name ("Rocket", "ChartBar"); accepts kebab/lower case; falls back to Square. */
export function resolveIcon(name: string | undefined): Icon {
  if (name) {
    const direct = ICONS[name];
    if (isIcon(direct)) return direct;
    const pascal = name
      .split(/[-_\s]+/)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join("");
    const byPascal = ICONS[pascal];
    if (isIcon(byPascal)) return byPascal;
  }
  return Phosphor.Square;
}
