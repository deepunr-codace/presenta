import type { Theme } from "@/lib/deck/schema";

export type GradientPreset = { label: string; css: string };

/** Six gradient presets derived from the theme palette (deck colours, not chrome tokens). */
export function gradientPresets(theme: Theme): GradientPreset[] {
  const c = theme.colors;
  return [
    { label: "Accent to background", css: `linear-gradient(135deg, ${c.accent} 0%, ${c.bg} 100%)` },
    { label: "Alt to accent", css: `linear-gradient(160deg, ${c.bgAlt} 0%, ${c.accent} 100%)` },
    { label: "Soft accent", css: `linear-gradient(180deg, ${c.accentSoft} 0%, ${c.bg} 100%)` },
    { label: "Ink to alt", css: `linear-gradient(135deg, ${c.ink} 0%, ${c.bgAlt} 100%)` },
    { label: "Radial glow", css: `radial-gradient(900px 600px at 20% 100%, ${c.accentSoft} 0%, ${c.bg} 70%)` },
    { label: "Warm sky", css: "linear-gradient(160deg, #FDE9E3 0%, #F8C6B7 50%, #F3A38D 100%)" },
  ];
}
