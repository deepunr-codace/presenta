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

  /* ---------- Studio pack themes: downloaded deck kits, each with its own exact font pairing ---------- */
  "aurora-night": {
    id: "aurora-night",
    name: "Aurora Night",
    description: "Near-black base with blurred blue, magenta and amber glow blobs.",
    fonts: { display: "var(--font-outfit)", body: "var(--font-dm)", displayWeight: 600, bodyWeight: 400, googleImport: "" },
    colors: { bg: "#0a0a0b", bgAlt: "#111113", surface: "rgba(243,240,234,0.045)", surfaceBorder: "rgba(243,240,234,0.16)", ink: "#f3f0ea", muted: "#b9b6bf", accent: "#2f5cff", accentInk: "#f3f0ea", accentSoft: "rgba(47,92,255,0.18)", line: "rgba(243,240,234,0.16)" },
    radius: 32,
    background: { default: "#0a0a0b", alt: "#111113" },
    card: { fill: "rgba(243,240,234,0.045)", border: "1px solid rgba(243,240,234,0.16)", shadow: "none", radius: 32 },
    swatch: ["#2f5cff", "#e8399f"],
  },
  "brutalist-mono": {
    id: "brutalist-mono",
    name: "Brutalist Mono",
    description: "Stark black and white with a monospace body and hard edges.",
    fonts: { display: "var(--font-space-grotesk)", body: "var(--font-jetbrains-mono)", displayWeight: 600, bodyWeight: 400, googleImport: "" },
    colors: { bg: "#ededea", bgAlt: "#0b0b0b", surface: "#ffffff", surfaceBorder: "#0b0b0b", ink: "#0b0b0b", muted: "#55554f", accent: "#3a5bff", accentInk: "#0b0b0b", accentSoft: "#e2e2de", line: "#0b0b0b" },
    radius: 0,
    background: { default: "#ededea", alt: "#0b0b0b" },
    card: { fill: "#ffffff", border: "1px solid #0b0b0b", shadow: "none", radius: 0 },
    swatch: ["#3a5bff", "#ff4d2e"],
  },
  "editorial-ivory": {
    id: "editorial-ivory",
    name: "Editorial Ivory",
    description: "Cream and ink with a serif display face, like a print magazine.",
    fonts: { display: "var(--font-playfair)", body: "var(--font-inter)", displayWeight: 600, bodyWeight: 400, googleImport: "" },
    colors: { bg: "#f4efe6", bgAlt: "#17140f", surface: "#ebe4d6", surfaceBorder: "rgba(23,20,15,0.18)", ink: "#17140f", muted: "#6b6457", accent: "#c8321e", accentInk: "#f4efe6", accentSoft: "rgba(200,50,30,0.12)", line: "rgba(23,20,15,0.2)" },
    radius: 4,
    background: { default: "#f4efe6", alt: "#17140f" },
    card: { fill: "rgba(23,20,15,0.035)", border: "1px solid rgba(23,20,15,0.18)", shadow: "none", radius: 4 },
    swatch: ["#c8321e", "#1d3a5f"],
  },
  "forest-calm": {
    id: "forest-calm",
    name: "Forest Calm",
    description: "Deep forest green with gold and terracotta accents, a warm serif display.",
    fonts: { display: "var(--font-fraunces)", body: "var(--font-manrope)", displayWeight: 500, bodyWeight: 400, googleImport: "" },
    colors: { bg: "#0f2a22", bgAlt: "#123428", surface: "rgba(241,234,217,0.06)", surfaceBorder: "rgba(241,234,217,0.18)", ink: "#f1ead9", muted: "#c6d2c3", accent: "#d9c27a", accentInk: "#0f2a22", accentSoft: "rgba(217,194,122,0.18)", line: "rgba(241,234,217,0.2)" },
    radius: 20,
    background: { default: "#0f2a22", alt: "#123428" },
    card: { fill: "rgba(241,234,217,0.06)", border: "1px solid rgba(241,234,217,0.18)", shadow: "none", radius: 20 },
    swatch: ["#d9c27a", "#6fb58a"],
  },
  "glass-frost": {
    id: "glass-frost",
    name: "Glass Frost",
    description: "Pastel blue-violet gradient with translucent frosted glass cards.",
    fonts: { display: "var(--font-plus-jakarta)", body: "var(--font-manrope)", displayWeight: 600, bodyWeight: 400, googleImport: "" },
    colors: { bg: "#e4ecff", bgAlt: "#101733", surface: "rgba(255,255,255,0.55)", surfaceBorder: "rgba(255,255,255,0.95)", ink: "#101733", muted: "#555e86", accent: "#4a5cff", accentInk: "#ffffff", accentSoft: "rgba(74,92,255,0.14)", line: "rgba(16,23,51,0.16)" },
    radius: 18,
    background: { default: "linear-gradient(135deg,#dfe8ff,#f1e6ff 55%,#e0f5f5)", alt: "#101733" },
    card: { fill: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.95)", shadow: "none", radius: 18 },
    swatch: ["#4a5cff", "#a65cff"],
  },
  "luxe-noir": {
    id: "luxe-noir",
    name: "Luxe Noir",
    description: "Near-black with champagne gold and a high-contrast serif.",
    fonts: { display: "var(--font-cormorant)", body: "var(--font-montserrat)", displayWeight: 600, bodyWeight: 400, googleImport: "" },
    colors: { bg: "#0b0b0c", bgAlt: "#121214", surface: "rgba(201,163,92,0.05)", surfaceBorder: "rgba(201,163,92,0.4)", ink: "#efe7d6", muted: "#968f80", accent: "#c9a35c", accentInk: "#0b0b0c", accentSoft: "rgba(201,163,92,0.15)", line: "rgba(201,163,92,0.35)" },
    radius: 0,
    background: { default: "#0b0b0c", alt: "#121214" },
    card: { fill: "rgba(201,163,92,0.05)", border: "1px solid rgba(201,163,92,0.4)", shadow: "none", radius: 0 },
    swatch: ["#c9a35c", "#e6c987"],
  },
  "neon-grid": {
    id: "neon-grid",
    name: "Neon Grid",
    description: "Deep indigo-black with cyan and magenta neon, a wide geometric display face.",
    fonts: { display: "var(--font-unbounded)", body: "var(--font-instrument-sans)", displayWeight: 600, bodyWeight: 400, googleImport: "" },
    colors: { bg: "#07070f", bgAlt: "#0c0c18", surface: "rgba(255,255,255,0.04)", surfaceBorder: "rgba(0,229,255,0.38)", ink: "#eaf6ff", muted: "#b4c4d6", accent: "#00e5ff", accentInk: "#07070f", accentSoft: "rgba(0,229,255,0.18)", line: "rgba(0,229,255,0.28)" },
    radius: 4,
    background: { default: "#07070f", alt: "#0c0c18" },
    card: { fill: "rgba(255,255,255,0.04)", border: "1px solid rgba(0,229,255,0.38)", shadow: "none", radius: 4 },
    swatch: ["#00e5ff", "#ff2bd6"],
  },
  "pop-blocks": {
    id: "pop-blocks",
    name: "Pop Blocks",
    description: "Cream with primary-colour solid shapes and a bold geometric sans.",
    fonts: { display: "var(--font-syne)", body: "var(--font-instrument-sans)", displayWeight: 700, bodyWeight: 400, googleImport: "" },
    colors: { bg: "#f6f0e4", bgAlt: "#111111", surface: "#ffffff", surfaceBorder: "#111111", ink: "#111111", muted: "#5e5a4f", accent: "#2d4bff", accentInk: "#ffffff", accentSoft: "#efe6d2", line: "#111111" },
    radius: 16,
    background: { default: "#f6f0e4", alt: "#111111" },
    card: { fill: "#ffffff", border: "1px solid #111111", shadow: "none", radius: 16 },
    swatch: ["#2d4bff", "#ff4f9a"],
  },
  "sunset-retro": {
    id: "sunset-retro",
    name: "Sunset Retro",
    description: "Deep purple dusk with an orange-to-pink sunset gradient and a bold grotesque.",
    fonts: { display: "var(--font-bricolage)", body: "var(--font-instrument-sans)", displayWeight: 600, bodyWeight: 400, googleImport: "" },
    colors: { bg: "#1d0f2b", bgAlt: "#26123a", surface: "rgba(255,241,224,0.06)", surfaceBorder: "rgba(255,241,224,0.2)", ink: "#fff1e0", muted: "#e9cfc6", accent: "#ff6b3d", accentInk: "#1d0f2b", accentSoft: "rgba(255,107,61,0.18)", line: "rgba(255,241,224,0.2)" },
    radius: 12,
    background: { default: "#1d0f2b", alt: "#26123a" },
    card: { fill: "rgba(255,241,224,0.06)", border: "1px solid rgba(255,241,224,0.2)", shadow: "none", radius: 12 },
    swatch: ["#ff6b3d", "#ff3d8b"],
  },
  "swiss-minimal": {
    id: "swiss-minimal",
    name: "Swiss Minimal",
    description: "Off-white with a single red accent, thin rules and a grotesque sans.",
    fonts: { display: "var(--font-archivo)", body: "var(--font-inter)", displayWeight: 600, bodyWeight: 400, googleImport: "" },
    colors: { bg: "#f7f7f5", bgAlt: "#111111", surface: "transparent", surfaceBorder: "#111111", ink: "#111111", muted: "#6a6a66", accent: "#e5231b", accentInk: "#ffffff", accentSoft: "#ecece8", line: "#111111" },
    radius: 0,
    background: { default: "#f7f7f5", alt: "#111111" },
    card: { fill: "transparent", border: "1px solid #111111", shadow: "none", radius: 0 },
    swatch: ["#e5231b", "#111111"],
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
