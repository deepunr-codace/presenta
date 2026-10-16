import type { FontPair } from "@/lib/deck/schema";

export const FONT_PAIRS: { id: FontPair; label: string }[] = [
  { id: "inter", label: "Inter" },
  { id: "dm", label: "DM Sans" },
  { id: "oswald", label: "Oswald + Roboto" },
  { id: "roboto", label: "Roboto" },
];

export const FONT_ITEMS: Record<string, string> = { theme: "Theme default", ...Object.fromEntries(FONT_PAIRS.map((f) => [f.id, f.label])) };

/** Brand accent presets are deck colours (they land on slides), not app chrome tokens. */
export const ACCENT_PRESETS = ["#1B5FD9", "#094FFF", "#7C3AED", "#DB2777", "#DC2626", "#EA580C", "#059669", "#0F172A"] as const;

export const LOGO_MAX_BYTES = 1_000_000;
