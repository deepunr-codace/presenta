import type { Theme } from "@/lib/deck/schema";

export const HEX = /^#[0-9a-f]{6}$/i;

/** Neutral shown for a token swatch when no theme is available. */
const FALLBACK_SWATCH = "var(--ps-ash)";

/** Named colour tokens accepted by the renderer (see canvas/tokens.ts). */
const COLOR_TOKENS: { value: string; label: string; pick: (t: Theme) => string }[] = [
  { value: "accent", label: "Accent", pick: (t) => t.colors.accent },
  { value: "ink", label: "Ink", pick: (t) => t.colors.ink },
  { value: "muted", label: "Muted", pick: (t) => t.colors.muted },
  { value: "accentSoft", label: "Accent soft", pick: (t) => t.colors.accentSoft },
  { value: "surface", label: "Surface", pick: (t) => t.colors.surface },
  { value: "bg", label: "Background", pick: (t) => t.colors.bg },
];

export type ColorPreset = { value: string; label: string; css: string };

/* Deck colours (they land on slides), not chrome tokens. */
const NEUTRALS: ColorPreset[] = [
  { value: "#FFFFFF", label: "White", css: "#FFFFFF" },
  { value: "#1A1A1A", label: "Black", css: "#1A1A1A" },
  { value: "#F05A3C", label: "Coral", css: "#F05A3C" },
  { value: "#1B5FD9", label: "Cobalt", css: "#1B5FD9" },
  { value: "#2E9E6B", label: "Green", css: "#2E9E6B" },
  { value: "#D9932B", label: "Amber", css: "#D9932B" },
  { value: "#7C3AED", label: "Violet", css: "#7C3AED" },
  { value: "#9A9A9A", label: "Grey", css: "#9A9A9A" },
];

/** Twelve presets: the six named tokens plus theme and neutral hexes (hexes only when `hexOnly`). */
export function colorPresets(theme: Theme | undefined, hexOnly = false): ColorPreset[] {
  const themeHex: ColorPreset[] = theme
    ? [
        { value: theme.colors.accent, label: "Theme accent", css: theme.colors.accent },
        { value: theme.colors.ink, label: "Theme ink", css: theme.colors.ink },
        { value: theme.colors.bg, label: "Theme background", css: theme.colors.bg },
        { value: theme.colors.bgAlt, label: "Theme alt background", css: theme.colors.bgAlt },
      ]
    : [];
  if (hexOnly) {
    const seen = new Set<string>();
    return [...themeHex, ...NEUTRALS].filter((p) => HEX.test(p.value) && !seen.has(p.value.toUpperCase()) && seen.add(p.value.toUpperCase())).slice(0, 12);
  }
  const tokens: ColorPreset[] = COLOR_TOKENS.map((t) => ({ value: t.value, label: t.label, css: theme ? t.pick(theme) : FALLBACK_SWATCH }));
  return [...tokens, ...themeHex, ...NEUTRALS].slice(0, 12);
}

/** CSS colour for a stored value (token or CSS colour) so the swatch can show it. */
export function swatchCss(value: string | undefined, theme: Theme | undefined): string | undefined {
  if (!value) return undefined;
  const token = COLOR_TOKENS.find((t) => t.value === value);
  if (token) return theme ? token.pick(theme) : FALLBACK_SWATCH;
  return value;
}

/** Human label for a stored value: the token name, the raw value, or the empty label. */
export function colorLabel(value: string | undefined, emptyLabel: string): string {
  if (!value) return emptyLabel;
  return COLOR_TOKENS.find((t) => t.value === value)?.label ?? value;
}
