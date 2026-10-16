import type { SlideBackground, Theme } from "@/lib/deck/schema";

/**
 * Slide-level colour tokens shared by the canvas renderer and the PPTX
 * export. Pure functions of theme and background; nothing here touches the
 * DOM, so both the client bundle and server code can import it.
 */

function parseColor(input: string): [number, number, number] | null {
  const s = input.trim();
  const hex = /^#([0-9a-f]{3,8})$/i.exec(s);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) h = h.split("").map((c) => c + c).join("");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const rgb = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(s);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return null;
}

/** True when the colour's relative luminance is below 0.35; unparseable values count as light. */
export function isDarkColor(input: string): boolean {
  const c = parseColor(input);
  if (!c) return false;
  const [r, g, b] = c.map((v) => {
    const n = v / 255;
    return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.35;
}

export type SlideTokens = {
  vars: Record<`--deck-${string}`, string>;
  dark: boolean;
};

/**
 * CSS variables for one slide. The theme's ink/muted are swapped for a
 * contrasting pair when the slide sits on the theme's alt background, a solid
 * colour or an image, so layouts stay colour-agnostic.
 */
export function slideTokens(theme: Theme, background: SlideBackground): SlideTokens {
  const c = theme.colors;
  const themeDark = isDarkColor(c.bg);
  let dark = themeDark;
  if (background.kind === "theme") dark = background.variant === "alt" ? isDarkColor(c.bgAlt) : themeDark;
  else if (background.kind === "solid") dark = isDarkColor(background.color);
  else if (background.kind === "image") dark = background.overlay >= 0.25;
  else dark = themeDark;

  const flipped = dark !== themeDark;
  const ink = flipped ? (dark ? "#FFFFFF" : "#0E1A3A") : c.ink;
  const muted = flipped ? (dark ? "rgba(255,255,255,0.72)" : "rgba(14,26,58,0.68)") : c.muted;
  const line = flipped ? (dark ? "rgba(255,255,255,0.22)" : "rgba(14,26,58,0.22)") : c.line;
  const surfaceBorder = flipped ? line : c.surfaceBorder;
  const accent = flipped && dark && isDarkColor(c.accent) ? c.accentSoft : c.accent;
  const accentInk = accent === c.accentSoft ? c.ink : c.accentInk;

  return {
    dark,
    vars: {
      "--deck-display": theme.fonts.display,
      "--deck-body": theme.fonts.body,
      "--deck-bg": dark ? c.bgAlt : c.bg,
      "--deck-ink": ink,
      "--deck-muted": muted,
      "--deck-accent": accent,
      "--deck-accent-ink": accentInk,
      "--deck-accent-soft": c.accentSoft,
      "--deck-surface": c.surface,
      "--deck-surface-border": surfaceBorder,
      "--deck-line": line,
      "--deck-radius": `${theme.radius}px`,
    },
  };
}
