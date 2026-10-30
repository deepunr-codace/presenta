import { newId } from "./ids";
import { buildDeck } from "./layouts";
import type { Deck, Element, Generation, Slide, ThemeId } from "./schema";

/**
 * Real, pre-designed deck templates: a hand-built cover slide (gradient background, specific type treatment) plus a
 * few supporting slides from the normal layout engine. Unlike the wizard's starters, these do not go through the AI;
 * picking one just clones a finished deck.
 */

let z = 0;
const nextZ = () => z++;

type TextOpts = { color?: string; weight?: number; size?: number; align?: "left" | "center" | "right"; letterSpacing?: number; fontFamily?: "display" | "body" };

function text(html: string, x: number, y: number, w: number, h: number, opts: TextOpts = {}): Element {
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
    style: { color: opts.color, fontWeight: opts.weight ?? 700, fontSize: opts.size ?? 28, letterSpacing: opts.letterSpacing, fontFamily: opts.fontFamily ?? "display" },
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

export const TEMPLATE_DECKS: TemplateDeckDef[] = [
  { id: "tmpl-pitch-violet", title: "Pitch deck", category: "Business", deck: makeDeck("Pitch Deck", "midnight", violetGlowCover(), SUPPORT) },
  { id: "tmpl-startup-iridescent", title: "Startup pitch deck", category: "Business", deck: makeDeck("Startup Pitch Deck", "midnight", iridescentCover(), SUPPORT) },
  { id: "tmpl-group-project", title: "Group project", category: "Education", deck: makeDeck("Group Project", "midnight", groupProjectCover(), SUPPORT) },
  { id: "tmpl-business-report", title: "Business report", category: "Business", deck: makeDeck("Business Report", "cobalt-stripes", navyReportCover(), SUPPORT) },
  { id: "tmpl-creative-solutions", title: "Creative solutions", category: "Team", deck: makeDeck("Creative Solutions", "sky-facet", creativeSolutionsCover(), SUPPORT) },
  { id: "tmpl-editorial-mono", title: "Pitch deck, editorial", category: "Product", deck: makeDeck("Pitch Deck", "paper", editorialMonoCover(), SUPPORT) },
];
