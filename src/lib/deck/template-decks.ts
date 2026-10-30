import { newId } from "./ids";
import { buildDeck } from "./layouts";
import type { ChartElement, Deck, Element, Generation, ImageElement, Slide, ThemeId } from "./schema";

/**
 * Real, pre-designed deck templates: a hand-built cover slide (gradient background, specific type treatment) plus a
 * few supporting slides from the normal layout engine. Unlike the wizard's starters, these do not go through the AI;
 * picking one just clones a finished deck.
 */

let z = 0;
const nextZ = () => z++;

/** `letterSpacing` is in px-equivalent units at the given size; the schema stores it as em, so it is converted below. */
type TextOpts = { color?: string; weight?: number; size?: number; align?: "left" | "center" | "right"; letterSpacing?: number; fontFamily?: "display" | "body" };

function text(html: string, x: number, y: number, w: number, h: number, opts: TextOpts = {}): Element {
  const size = opts.size ?? 28;
  return {
    id: newId("el"),
    type: "text",
    role: "title",
    html,
    x,
    y,
    w,
    h,
    rotation: 0,
    z: nextZ(),
    locked: false,
    opacity: 1,
    align: opts.align ?? "left",
    valign: "top",
    autoFit: false,
    style: { color: opts.color, fontWeight: opts.weight ?? 700, fontSize: size, letterSpacing: opts.letterSpacing !== undefined ? opts.letterSpacing / size : undefined, fontFamily: opts.fontFamily ?? "display" },
  };
}

type ShapeOpts = { stroke?: string; strokeWidth?: number; radius?: number; opacity?: number };

function shape(kind: "rect" | "ellipse" | "line" | "pill", fill: string, x: number, y: number, w: number, h: number, opts: ShapeOpts = {}): Element {
  return { id: newId("el"), type: "shape", kind, fill, stroke: opts.stroke, strokeWidth: opts.strokeWidth ?? 0, radius: opts.radius ?? 0, x, y, w, h, rotation: 0, z: nextZ(), locked: false, opacity: opts.opacity ?? 1 };
}

function pill(label: string, x: number, y: number, w: number, h: number, opts: { fg?: string; bg?: string } = {}): Element[] {
  return [
    shape("pill", opts.bg ?? "rgba(255,255,255,0.1)", x, y, w, h, { stroke: opts.fg ?? "rgba(255,255,255,0.4)", strokeWidth: 1, radius: 999 }),
    text(label, x, y, w, h, { color: opts.fg ?? "#fff", size: 18, weight: 500, align: "center", fontFamily: "body" }),
  ];
}

function blob(cx: number, cy: number, d: number, fill: string): Element {
  return shape("ellipse", fill, cx - d / 2, cy - d / 2, d, d);
}

function ring(cx: number, cy: number, d: number, stroke: string, strokeWidth = 1.5): Element {
  return shape("ellipse", "transparent", cx - d / 2, cy - d / 2, d, d, { stroke, strokeWidth });
}

function line(x: number, y: number, w: number, h: number, stroke: string): Element {
  return shape("rect", stroke, x, y, w, h);
}

/** Builds a template deck: the hand-authored cover as slide 1, then supporting slides from the layout engine. */
function makeDeck(title: string, themeId: ThemeId, cover: Slide, support: Generation["slides"]): Deck {
  z = 0;
  const base = buildDeck({ title, slides: [{ kind: "cover", title }, ...support] }, themeId);
  return { ...base, slides: [cover, ...base.slides.slice(1)] };
}

const SUPPORT: Generation["slides"] = [
  { kind: "section", title: "What we'll cover", subtitle: "A short walk through the plan" },
  { kind: "bullets", title: "Key points", bullets: ["Where we are today", "What's changing", "What we need from you", "Timeline and next steps"] },
  { kind: "closing", title: "Thank you", subtitle: "Questions and discussion", body: "" },
];

export type TemplateDeckDef = { id: string; title: string; category: "Business" | "Product" | "Education" | "Team"; deck: Deck };

function violetGlowCover(): Slide {
  z = 0;
  return {
    id: newId("slide"),
    layoutId: "cover",
    background: { kind: "gradient", css: "radial-gradient(1100px 700px at 20% 15%, #6D28D9 0%, transparent 60%), radial-gradient(900px 900px at 85% 90%, #312E81 0%, transparent 55%), linear-gradient(160deg, #1E1033 0%, #2A1458 60%, #140B26 100%)" },
    elements: [
      ring(1550, 240, 520, "rgba(255,255,255,0.18)"),
      ring(1550, 240, 360, "rgba(255,255,255,0.12)"),
      text("Larana Company", 96, 72, 500, 36, { color: "rgba(255,255,255,0.8)", size: 20, weight: 500, fontFamily: "body" }),
      text("Presented by:<br/>Drew Felg", 1424, 64, 400, 70, { color: "rgba(255,255,255,0.65)", size: 16, weight: 400, align: "right", fontFamily: "body" }),
      text("Pitch<br/>Deck", 96, 330, 900, 420, { color: "#fff", size: 128, weight: 800, letterSpacing: -3 }),
      text("Business Presentation", 100, 760, 600, 48, { color: "rgba(255,255,255,0.75)", size: 26, weight: 400, fontFamily: "body" }),
      ...pill("July 7, 2025", 1440, 940, 300, 48),
    ],
    notes: "",
  };
}

function iridescentCover(): Slide {
  z = 0;
  return {
    id: newId("slide"),
    layoutId: "cover",
    background: { kind: "solid", color: "#0A0A0A" },
    elements: [
      blob(1480, 260, 760, "conic-gradient(from 120deg, #FF7A59, #FFD36E, #6EE7F9, #C084FC, #FF7A59)"),
      shape("ellipse", "#0A0A0A", 1480 - 380, 260 - 380, 760, 760, { opacity: 0.55 }),
      text("Liceria &amp; Co. Company", 96, 72, 500, 36, { color: "#F97316", size: 18, weight: 600, fontFamily: "body", letterSpacing: 1 }),
      text("Startup<br/>Pitch Deck", 96, 300, 1100, 340, { color: "#fff", size: 92, weight: 800, letterSpacing: -2 }),
      ...pill("Present By : Olivia Wilson", 96, 660, 440, 56, { fg: "#fff" }),
      text("www.reallygreatsite.com", 96, 940, 500, 36, { color: "rgba(255,255,255,0.55)", size: 16, weight: 400, fontFamily: "body" }),
    ],
    notes: "",
  };
}

function groupProjectCover(): Slide {
  z = 0;
  return {
    id: newId("slide"),
    layoutId: "cover",
    background: { kind: "solid", color: "#0B0B0D" },
    elements: [
      blob(1500, 220, 820, "radial-gradient(circle at 30% 30%, #F59E0B 0%, transparent 45%), radial-gradient(circle at 70% 70%, #2563EB 0%, transparent 55%)"),
      text("BORCELLE", 96, 72, 400, 32, { color: "rgba(255,255,255,0.8)", size: 18, weight: 600, fontFamily: "body", letterSpacing: 2 }),
      text("&#8599;", 1780, 64, 60, 60, { color: "#fff", size: 32, weight: 400, fontFamily: "body" }),
      text("Group<br/>Project", 96, 340, 1000, 360, { color: "#fff", size: 104, weight: 800, letterSpacing: -2 }),
      text("DECEMBER 2030", 96, 940, 400, 32, { color: "rgba(255,255,255,0.6)", size: 16, weight: 500, fontFamily: "body", letterSpacing: 1 }),
      text("reallygreatsite.com", 1480, 940, 360, 32, { color: "rgba(255,255,255,0.6)", size: 16, weight: 400, align: "right", fontFamily: "body" }),
    ],
    notes: "",
  };
}

function navyReportCover(): Slide {
  z = 0;
  return {
    id: newId("slide"),
    layoutId: "cover",
    background: { kind: "solid", color: "#0D1B3E" },
    elements: [
      ring(140, 760, 720, "rgba(255,255,255,0.10)", 2),
      ring(140, 760, 520, "rgba(255,255,255,0.08)", 2),
      shape("ellipse", "#2563EB", 70, 690, 42, 42),
      text("ginyard", 136, 686, 240, 40, { color: "#fff", size: 22, weight: 700, fontFamily: "body" }),
      text("Menu", 1060, 696, 80, 28, { color: "rgba(255,255,255,0.7)", size: 15, weight: 400, fontFamily: "body" }),
      text("About Us", 1156, 696, 110, 28, { color: "rgba(255,255,255,0.7)", size: 15, weight: 400, fontFamily: "body" }),
      ...pill("@reallygreatsite", 1300, 680, 260, 48),
      text("business<br/>report", 96, 300, 900, 360, { color: "#fff", size: 100, weight: 800, letterSpacing: -2 }),
      ...pill("Finance Division", 96, 700, 300, 48),
    ],
    notes: "",
  };
}

function creativeSolutionsCover(): Slide {
  z = 0;
  return {
    id: newId("slide"),
    layoutId: "cover",
    background: { kind: "gradient", css: "radial-gradient(1400px 900px at 30% 20%, #1D4ED8 0%, transparent 55%), radial-gradient(1200px 900px at 90% 100%, #0EA5E9 0%, transparent 50%), linear-gradient(170deg, #050B2A 0%, #0B1550 100%)" },
    elements: [
      text("Studio Shodwe", 96, 72, 320, 32, { color: "rgba(255,255,255,0.75)", size: 16, weight: 500, fontFamily: "body" }),
      text("AUGUST 2030", 820, 72, 280, 32, { color: "rgba(255,255,255,0.75)", size: 14, weight: 500, align: "center", fontFamily: "body", letterSpacing: 1 }),
      text("@reallygreatsite", 1520, 72, 304, 32, { color: "rgba(255,255,255,0.75)", size: 16, weight: 500, align: "right", fontFamily: "body" }),
      text("Creative", 96, 300, 900, 200, { color: "#fff", size: 110, weight: 800, letterSpacing: -2 }),
      text("Solutions", 96, 480, 1100, 200, { color: "#fff", size: 110, weight: 300, letterSpacing: -2, fontFamily: "body" }),
      text("Marketing Agency Profile Presentation", 96, 900, 700, 32, { color: "rgba(255,255,255,0.8)", size: 16, weight: 600, fontFamily: "body", letterSpacing: 1 }),
      text("Presented by Olivia Wilson", 96, 940, 500, 28, { color: "rgba(255,255,255,0.55)", size: 14, weight: 400, fontFamily: "body" }),
      text("www.reallygreatsite.com", 1500, 940, 324, 28, { color: "rgba(255,255,255,0.55)", size: 14, weight: 400, align: "right", fontFamily: "body" }),
    ],
    notes: "",
  };
}

function editorialMonoCover(): Slide {
  z = 0;
  return {
    id: newId("slide"),
    layoutId: "cover",
    background: { kind: "solid", color: "#F4F2EE" },
    elements: [
      text("Liceria &amp; Co.", 96, 64, 300, 32, { color: "#111", size: 16, weight: 700, fontFamily: "body" }),
      ...pill("Contact", 760, 56, 130, 44, { fg: "#111", bg: "rgba(0,0,0,0.04)" }),
      ...pill("Service", 900, 56, 130, 44, { fg: "#fff", bg: "#111" }),
      ...pill("Home", 1040, 56, 120, 44, { fg: "#111", bg: "rgba(0,0,0,0.04)" }),
      text("PITCH", 96, 320, 860, 240, { color: "#111", size: 150, weight: 800, letterSpacing: -4 }),
      line(980, 330, 6, 230, "#111"),
      text("DECK", 1020, 320, 820, 240, { color: "#111", size: 150, weight: 800, letterSpacing: -4 }),
      text("Presented To: Larana, Inc.", 96, 940, 440, 32, { color: "#555", size: 16, weight: 500, fontFamily: "body" }),
      text("Presented By: Lars Peeters", 1380, 940, 444, 32, { color: "#555", size: 16, weight: 500, align: "right", fontFamily: "body" }),
      ...pill("Page 01", 860, 1000, 200, 36, { fg: "#111", bg: "rgba(0,0,0,0.05)" }),
    ],
    notes: "",
  };
}

/* ---------- Aurora: a full 7-slide dark deck with blurred gradient "blob" glow ---------- */

const AURORA_BG = "#0a0a0b";
const AURORA_LINE = "rgba(243,240,234,0.16)";
const AURORA_INK = "#f3f0ea";
const AURORA_INK_2 = "#b9b6bf";
const AURORA_INK_3 = "#8f8c96";

/** `x`/`y` are the blob's center as a percent of the slide. */
function auroraBlob(xPct: number, yPct: number, w: number, h: number, a: string, b: string): string {
  return `radial-gradient(${w}px ${h}px at ${xPct}% ${yPct}%, ${a} 0%, ${b} 42%, transparent 72%)`;
}

function auroraBackground(...blobs: string[]): Slide["background"] {
  return { kind: "gradient", css: [...blobs, `linear-gradient(${AURORA_BG}, ${AURORA_BG})`].join(", ") };
}

function auroraEyebrow(label: string, x: number, y: number, align: "left" | "right" = "left"): Element[] {
  return [text(label, x, y, 500, 32, { color: AURORA_INK, size: 20, weight: 500, letterSpacing: 2, fontFamily: "body", align })];
}

function auroraFolio(brand: string, page: string): Element[] {
  return [
    text(brand, 96, 1012, 500, 28, { color: AURORA_INK_3, size: 16, weight: 500, letterSpacing: 1.5, fontFamily: "body" }),
    text(page, 1420, 1012, 404, 28, { color: AURORA_INK_3, size: 16, weight: 500, letterSpacing: 1.5, fontFamily: "body", align: "right" }),
  ];
}

function image(query: string, x: number, y: number, w: number, h: number): ImageElement {
  return { id: newId("el"), type: "image", query, alt: "", fit: "cover", radius: 20, position: "50% 50%", overlay: 0, x, y, w, h, rotation: 0, z: nextZ(), locked: false, opacity: 1 };
}

function auroraCover(): Slide {
  z = 0;
  return {
    id: newId("slide"),
    layoutId: "cover",
    background: auroraBackground(auroraBlob(50, 46, 1180, 560, "#3d6bff", "#16279a"), auroraBlob(70, 55, 760, 420, "#ff9a2e", "#b8360c"), auroraBlob(58, 46, 420, 300, "#e8399f", "#6d1766")),
    elements: [
      ...auroraEyebrow("NOVA COLLECTIVE", 96, 72),
      text("&#8599;", 1800, 64, 48, 48, { color: AURORA_INK, size: 32, fontFamily: "body" }),
      text("Strategy<br/>Briefing FY26", 96, 300, 1500, 440, { color: AURORA_INK, size: 140, weight: 600, letterSpacing: -4 }),
      text("October 2026", 96, 950, 360, 32, { color: AURORA_INK, size: 20, weight: 500, letterSpacing: 2, fontFamily: "body" }),
      text("Prepared for the leadership offsite", 660, 950, 600, 36, { color: AURORA_INK_2, size: 24, weight: 400, fontFamily: "body", align: "center" }),
      text("nova.co", 1560, 950, 264, 32, { color: AURORA_INK, size: 20, weight: 500, letterSpacing: 2, fontFamily: "body", align: "right" }),
    ],
    notes: "",
  };
}

function auroraAgenda(): Slide {
  z = 0;
  const items: [string, string][] = [["Where we stand", "03"], ["Market shift", "05"], ["The three bets", "08"], ["Resourcing", "12"], ["The ask", "14"]];
  const rows: Element[] = items.flatMap(([title, page], i) => {
    const y = 420 + i * 86;
    return [
      line(96, y, 1728, 1, AURORA_LINE),
      text(String(i + 1).padStart(2, "0"), 96, y + 20, 100, 32, { color: AURORA_INK_3, size: 20, weight: 400, letterSpacing: 2, fontFamily: "body" }),
      text(title, 300, y + 14, 1200, 50, { color: AURORA_INK, size: 42, weight: 500, letterSpacing: -1 }),
      text(page, 1680, y + 20, 144, 32, { color: AURORA_INK_3, size: 20, weight: 400, fontFamily: "body", align: "right" }),
    ];
  });
  const lastY = 420 + items.length * 86;
  return {
    id: newId("slide"),
    layoutId: "blank",
    background: auroraBackground(auroraBlob(2, 65, 900, 700, "#2f5cff", "#14238f"), auroraBlob(14, 78, 520, 380, "#ff9a2e", "#b8360c")),
    elements: [
      ...auroraEyebrow("AGENDA", 96, 96),
      text("What we'll cover", 96, 160, 900, 140, { color: AURORA_INK, size: 88, weight: 600, letterSpacing: -2 }),
      text("Five topics, thirty minutes, one decision at the end.", 96, 300, 700, 48, { color: AURORA_INK_2, size: 26, weight: 400, fontFamily: "body" }),
      ...rows,
      line(96, lastY, 1728, 1, AURORA_LINE),
      ...auroraFolio("NOVA COLLECTIVE", "02 / 07"),
    ],
    notes: "",
  };
}

function auroraTeam(): Slide {
  z = 0;
  const members: [string, string, string][] = [
    ["Mira Chen", "Head of Strategy", "portrait of a confident strategy lead, studio lighting, grayscale"],
    ["Owen Park", "VP Product", "portrait of a product executive, studio lighting, grayscale"],
    ["Sasha Rao", "VP Growth", "portrait of a growth executive, studio lighting, grayscale"],
    ["Leo Fontaine", "Finance Lead", "portrait of a finance lead, studio lighting, grayscale"],
  ];
  const colW = 384;
  const gap = 32;
  const cards: Element[] = members.flatMap(([name, role, query], i) => {
    const x = 96 + i * (colW + gap);
    return [image(query, x, 320, colW, 400), text(name, x, 744, colW, 48, { color: AURORA_INK, size: 30, weight: 500, letterSpacing: -1 }), text(role, x, 790, colW, 32, { color: AURORA_INK_3, size: 18, weight: 400, fontFamily: "body", letterSpacing: 1 })];
  });
  return {
    id: newId("slide"),
    layoutId: "blank",
    background: auroraBackground(auroraBlob(72, 10, 1000, 520, "#e8399f", "#6d1766"), auroraBlob(90, 15, 800, 420, "#2f5cff", "#14238f")),
    elements: [...auroraEyebrow("THE TEAM", 96, 96), text("Who's in the room", 96, 160, 1000, 140, { color: AURORA_INK, size: 72, weight: 600, letterSpacing: -2 }), ...cards, ...auroraFolio("NOVA COLLECTIVE", "03 / 07")],
    notes: "",
  };
}

function auroraObjectives(): Slide {
  z = 0;
  const cols: [string, string, string][] = [
    ["01", "Focus", "We stop shipping sideways and commit to the two bets that move the number."],
    ["02", "Speed", "Every team ships on a two-week cycle, no exceptions through Q2."],
    ["03", "Proof", "Each bet carries one metric the whole company can see weekly."],
  ];
  const colW = 544;
  const gap = 48;
  const items: Element[] = cols.flatMap(([num, title, body], i) => {
    const x = 96 + i * (colW + gap);
    return [
      ...(i > 0 ? [line(x - gap / 2, 500, 1, 280, AURORA_LINE)] : []),
      text(num, x, 500, 100, 32, { color: "#e8399f", size: 20, weight: 600, letterSpacing: 2, fontFamily: "body" }),
      text(title, x, 548, colW, 60, { color: AURORA_INK, size: 40, weight: 500, letterSpacing: -1 }),
      text(body, x, 620, colW - 20, 160, { color: AURORA_INK_2, size: 24, weight: 400, fontFamily: "body" }),
    ];
  });
  return {
    id: newId("slide"),
    layoutId: "blank",
    background: auroraBackground(auroraBlob(32, 70, 1100, 460, "#2f5cff", "#14238f"), auroraBlob(72, 74, 640, 360, "#ff9a2e", "#b8360c")),
    elements: [...auroraEyebrow("OBJECTIVES", 96, 96), text("Three things have to be true", 96, 160, 1200, 140, { color: AURORA_INK, size: 68, weight: 600, letterSpacing: -2 }), ...items, ...auroraFolio("NOVA COLLECTIVE", "04 / 07")],
    notes: "",
  };
}

function auroraData(): Slide {
  z = 0;
  const chart: ChartElement = {
    id: newId("el"),
    type: "chart",
    kind: "bar",
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
    series: [{ name: "Bookings ($M)", values: [40, 55, 48, 60, 66, 72] }],
    x: 936,
    y: 320,
    w: 888,
    h: 540,
    rotation: 0,
    z: nextZ(),
    locked: false,
    opacity: 1,
  };
  return {
    id: newId("slide"),
    layoutId: "blank",
    background: auroraBackground(auroraBlob(68, 56, 900, 560, "#2f5cff", "#14238f"), auroraBlob(26, 68, 560, 360, "#ff9a2e", "#b8360c")),
    elements: [
      ...auroraEyebrow("WHERE WE STAND", 96, 96),
      text("The numbers behind the ask", 96, 160, 760, 170, { color: AURORA_INK, size: 60, weight: 600, letterSpacing: -2 }),
      text("4.2x", 96, 560, 500, 170, { color: "#6f8dff", size: 150, weight: 600, letterSpacing: -5 }),
      text("Pipeline growth since the last review", 96, 710, 520, 60, { color: AURORA_INK_2, size: 26, weight: 400, fontFamily: "body" }),
      line(96, 800, 760, 1, AURORA_LINE),
      text("68%", 96, 832, 320, 92, { color: AURORA_INK, size: 72, weight: 600, letterSpacing: -2 }),
      text("Win rate on qualified deals", 96, 926, 340, 56, { color: AURORA_INK_2, size: 20, weight: 400, fontFamily: "body" }),
      text("11", 456, 832, 320, 92, { color: AURORA_INK, size: 72, weight: 600, letterSpacing: -2 }),
      text("New logos this quarter", 456, 926, 340, 56, { color: AURORA_INK_2, size: 20, weight: 400, fontFamily: "body" }),
      chart,
      ...auroraFolio("NOVA COLLECTIVE", "05 / 07"),
    ],
    notes: "",
  };
}

function auroraQuote(): Slide {
  z = 0;
  return {
    id: newId("slide"),
    layoutId: "blank",
    background: { kind: "gradient", css: [auroraBlob(50, 45, 1000, 520, "rgba(47,92,255,0.28)", "rgba(20,35,143,0.28)"), auroraBlob(70, 55, 640, 380, "rgba(232,57,159,0.22)", "rgba(109,23,102,0.22)"), "linear-gradient(#111113, #111113)"].join(", ") },
    elements: [
      text("&ldquo;", 96, 180, 300, 260, { color: "#e8399f", size: 260, weight: 600, fontFamily: "display" }),
      text("We closed the quarter five days faster than plan, and every region was looking at the same numbers for the first time.", 96, 420, 1480, 320, { color: AURORA_INK, size: 56, weight: 500, letterSpacing: -1 }),
      line(96, 820, 96, 2, "#e8399f"),
      text("Mira Chen", 224, 800, 400, 44, { color: AURORA_INK, size: 30, weight: 500, letterSpacing: -1 }),
      text("HEAD OF STRATEGY", 224, 846, 400, 32, { color: AURORA_INK_3, size: 18, weight: 500, letterSpacing: 2, fontFamily: "body" }),
      ...auroraFolio("NOVA COLLECTIVE", "06 / 07"),
    ],
    notes: "",
  };
}

function auroraClosing(): Slide {
  z = 0;
  const contacts: [string, string][] = [
    ["EMAIL", "hello@nova.co"],
    ["DECK", "nova.co/fy26"],
    ["NEXT", "Oct 30, 2026"],
  ];
  const colW = 544;
  const gap = 48;
  const items: Element[] = contacts.flatMap(([label, value], i) => {
    const x = 96 + i * (colW + gap);
    return [text(label, x, 880, colW, 28, { color: AURORA_INK_3, size: 18, weight: 500, letterSpacing: 2, fontFamily: "body" }), text(value, x, 912, colW, 56, { color: AURORA_INK, size: 36, weight: 500, letterSpacing: -1 })];
  });
  return {
    id: newId("slide"),
    layoutId: "closing",
    background: auroraBackground(auroraBlob(50, 46, 1180, 560, "#3d6bff", "#16279a"), auroraBlob(30, 55, 760, 420, "#ff9a2e", "#b8360c"), auroraBlob(42, 46, 420, 300, "#e8399f", "#6d1766")),
    elements: [
      text("&#8600;", 96, 64, 48, 48, { color: AURORA_INK, size: 32, fontFamily: "body" }),
      ...auroraEyebrow("THANK YOU", 1584, 72, "right"),
      text("Let's<br/>build it", 420, 300, 1304, 440, { color: AURORA_INK, size: 140, weight: 600, letterSpacing: -4, align: "right" }),
      line(96, 856, 1728, 1, AURORA_LINE),
      ...items,
    ],
    notes: "",
  };
}

function auroraDeck(): Deck {
  const now = new Date().toISOString();
  return {
    id: newId("deck"),
    title: "Aurora — Strategy Briefing",
    themeId: "midnight",
    slides: [auroraCover(), auroraAgenda(), auroraTeam(), auroraObjectives(), auroraData(), auroraQuote(), auroraClosing()],
    createdAt: now,
    updatedAt: now,
    meta: {},
    version: 1,
  };
}

export const TEMPLATE_DECKS: TemplateDeckDef[] = [
  { id: "tmpl-aurora", title: "Aurora", category: "Business", deck: auroraDeck() },
  { id: "tmpl-pitch-violet", title: "Pitch deck", category: "Business", deck: makeDeck("Pitch Deck", "midnight", violetGlowCover(), SUPPORT) },
  { id: "tmpl-startup-iridescent", title: "Startup pitch deck", category: "Business", deck: makeDeck("Startup Pitch Deck", "midnight", iridescentCover(), SUPPORT) },
  { id: "tmpl-group-project", title: "Group project", category: "Education", deck: makeDeck("Group Project", "midnight", groupProjectCover(), SUPPORT) },
  { id: "tmpl-business-report", title: "Business report", category: "Business", deck: makeDeck("Business Report", "cobalt-stripes", navyReportCover(), SUPPORT) },
  { id: "tmpl-creative-solutions", title: "Creative solutions", category: "Team", deck: makeDeck("Creative Solutions", "sky-facet", creativeSolutionsCover(), SUPPORT) },
  { id: "tmpl-editorial-mono", title: "Pitch deck, editorial", category: "Product", deck: makeDeck("Pitch Deck", "paper", editorialMonoCover(), SUPPORT) },
];
