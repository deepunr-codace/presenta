import type { Brand, Deck, Theme, ThemeId } from "./schema";

/**
 * Launch themes. Tokens only; layouts are theme-independent. Fonts are
 * loaded by next/font in layout.tsx, so `googleImport` is empty.
 */
export const THEMES: Record<ThemeId, Theme> = {
  "glass-contrast": {
    id: "glass-contrast",
    name: "Glass Contrast",
    description: "Frosted blue glass on a bright ground with a deep navy alt slide.",
    fonts: {
      display: "var(--font-inter-tight)",
      body: "var(--font-inter)",
      displayWeight: 600,
      bodyWeight: 400,
      googleImport: "",
    },
    colors: {
      bg: "#EEF4FF",
      bgAlt: "#0A1D5C",
      surface: "#FBFCFF",
      surfaceBorder: "rgba(110,140,205,0.55)",
      ink: "#0E1A3A",
      muted: "#465578",
      accent: "#1B5FD9",
      accentInk: "#FFFFFF",
      accentSoft: "#DCE8FF",
      line: "#C3CEE3",
    },
    radius: 28,
    background: {
      default:
        "radial-gradient(900px 600px at 6% 96%, rgba(190,214,255,0.9), transparent 70%), linear-gradient(135deg,#FFFFFF 0%,#EEF4FF 45%,#D3E2FB 100%)",
      alt: "radial-gradient(1200px 700px at 50% 110%, #123bb8 0%, #0a1d5c 32%, #050d2a 64%, #02061a 100%)",
    },
    card: {
      fill: "linear-gradient(180deg,#FFFFFF 0%,#F1F6FF 100%)",
      border: "1px solid rgba(110,140,205,0.55)",
      shadow: "0 20px 52px rgba(30,60,140,0.14)",
      radius: 28,
    },
    swatch: ["#EEF4FF", "#1B5FD9"],
  },
  "cobalt-stripes": {
    id: "cobalt-stripes",
    name: "Cobalt Stripes",
    description: "Black ground, cobalt blocks, hard edges and no shadows.",
    fonts: {
      display: "var(--font-inter)",
      body: "var(--font-inter)",
      displayWeight: 400,
      bodyWeight: 400,
      googleImport: "",
    },
    colors: {
      bg: "#000000",
      bgAlt: "#FFFFFF",
      surface: "#0B1230",
      surfaceBorder: "rgba(255,255,255,0.12)",
      ink: "#FFFFFF",
      muted: "#C9CFDD",
      accent: "#094FFF",
      accentInk: "#FFFFFF",
      accentSoft: "#DAE5FF",
      line: "rgba(255,255,255,0.12)",
    },
    radius: 0,
    background: {
      default: "#000000",
      alt: "linear-gradient(180deg,#DAE5FF 0%,#FFFFFF 45%)",
    },
    card: {
      fill: "linear-gradient(180deg,#094FFF 0%,#215FF2 55%,#5B8CFF 100%)",
      border: "none",
      shadow: "none",
      radius: 0,
    },
    swatch: ["#000000", "#094FFF"],
  },
  "sky-facet": {
    id: "sky-facet",
    name: "Sky Facet",
    description: "Airy light blue with crisp white surfaces and a bright cobalt accent.",
    fonts: {
      display: "var(--font-dm)",
      body: "var(--font-dm)",
      displayWeight: 500,
      bodyWeight: 400,
      googleImport: "",
    },
    colors: {
      bg: "#F3F7FF",
      bgAlt: "#B9D0FF",
      surface: "#FFFFFF",
      surfaceBorder: "#E3EAF8",
      ink: "#0F1B33",
      muted: "#55627A",
      accent: "#2F6BFF",
      accentInk: "#FFFFFF",
      accentSoft: "#E4EDFF",
      line: "rgba(15,27,51,0.3)",
    },
    radius: 24,
    background: {
      default: "#F3F7FF",
      alt: "linear-gradient(160deg,#2F6BFF 0%,#BBD3FF 100%)",
    },
    card: {
      fill: "#FFFFFF",
      border: "1px solid #E3EAF8",
      shadow: "none",
      radius: 24,
    },
    swatch: ["#F3F7FF", "#2F6BFF"],
  },
  midnight: {
    id: "midnight",
    name: "Midnight",
    description: "Dark navy with a soft cobalt glow and translucent surfaces.",
    fonts: {
      display: "var(--font-inter-tight)",
      body: "var(--font-inter)",
      displayWeight: 600,
      bodyWeight: 400,
      googleImport: "",
    },
    colors: {
      bg: "#070B1A",
      bgAlt: "#0E1B4D",
      surface: "rgba(255,255,255,0.06)",
      surfaceBorder: "rgba(255,255,255,0.12)",
      ink: "#FFFFFF",
      muted: "#A9B4D6",
      accent: "#4C7DFF",
      accentInk: "#FFFFFF",
      accentSoft: "rgba(76,125,255,0.18)",
      line: "rgba(255,255,255,0.14)",
    },
    radius: 20,
    background: {
      default:
        "radial-gradient(1100px 700px at 80% 100%, rgba(37,78,255,0.45), transparent 62%), linear-gradient(180deg,#0B1226,#070B1A)",
      alt: "linear-gradient(135deg,#0E1B4D,#070B1A)",
    },
    card: {
      fill: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.12)",
      shadow: "none",
      radius: 20,
    },
    swatch: ["#070B1A", "#4C7DFF"],
  },
  paper: {
    id: "paper",
    name: "Paper",
    description: "Warm minimal light with near-black ink and a burnt orange accent.",
    fonts: {
      display: "var(--font-inter-tight)",
      body: "var(--font-inter)",
      displayWeight: 600,
      bodyWeight: 400,
      googleImport: "",
    },
    colors: {
      bg: "#F7F5F0",
      bgAlt: "#1A1A1A",
      surface: "#FFFFFF",
      surfaceBorder: "#E6E1D6",
      ink: "#1A1A1A",
      muted: "#6B675F",
      accent: "#C2410C",
      accentInk: "#FFFFFF",
      accentSoft: "#FDE8DC",
      line: "#E6E1D6",
    },
    radius: 16,
    background: {
      default: "#F7F5F0",
      alt: "#1A1A1A",
    },
    card: {
      fill: "#FFFFFF",
      border: "1px solid #E6E1D6",
      shadow: "0 12px 32px rgba(0,0,0,0.06)",
      radius: 16,
    },
    swatch: ["#F7F5F0", "#C2410C"],
  },
};

export function getTheme(id: ThemeId): Theme {
  return THEMES[id];
}

const FONT_VARS: Record<NonNullable<Brand["fontPair"]>, { display: string; body: string }> = {
  inter: { display: "var(--font-inter-tight)", body: "var(--font-inter)" },
  dm: { display: "var(--font-dm)", body: "var(--font-dm)" },
  oswald: { display: "var(--font-oswald)", body: "var(--font-roboto)" },
  roboto: { display: "var(--font-roboto)", body: "var(--font-roboto)" },
};

/** Apply a deck's brand preferences (accent, font pair) on top of its theme. */
export function applyBrand(theme: Theme, brand?: Brand): Theme {
  if (!brand) return theme;
  const next: Theme = structuredClone(theme);
  if (brand.accent) {
    next.colors.accent = brand.accent;
    next.colors.accentSoft = `${brand.accent}22`;
    next.swatch = [next.swatch[0], brand.accent];
  }
  if (brand.fontPair) {
    next.fonts.display = FONT_VARS[brand.fontPair].display;
    next.fonts.body = FONT_VARS[brand.fontPair].body;
  }
  return next;
}

/** The theme a deck should render with: its themeId plus brand overrides. */
export function resolveTheme(deck: Pick<Deck, "themeId" | "meta">): Theme {
  return applyBrand(getTheme(deck.themeId), deck.meta?.brand);
}
