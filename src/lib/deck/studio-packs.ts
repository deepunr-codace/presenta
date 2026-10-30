import { newId } from "./ids";
import type { ChartElement, Deck, Element, ImageElement, Slide, ThemeId } from "./schema";
import type { TemplateDeckDef } from "./template-decks";

/**
 * Ten downloaded "studio pack" deck kits: flat solid-shape accents (no blur), each with its own font pairing and
 * theme (see themes.ts). One generic slide-type library, reused across packs with different skins; every pack picks
 * the subset and order of slide types its own kit shipped.
 */

let z = 0;
const nextZ = () => z++;

type Skin = {
  themeId: ThemeId;
  brand: string;
  bg: string;
  bgAlt?: string;
  ink: string;
  ink2: string;
  ink3: string;
  line: string;
  card: string;
  a1: string;
  a2: string;
  a3: string;
  onA: string;
  radius: number;
  motif: "circle-duo" | "ring" | "square-trio" | "sunset" | "circle-solo";
};

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

function line(x: number, y: number, w: number, h: number, stroke: string): Element {
  return shape("rect", stroke, x, y, w, h);
}

function pill(label: string, x: number, y: number, w: number, h: number, fg: string, bg: string): Element[] {
  return [shape("pill", bg, x, y, w, h, { radius: 999 }), text(label, x, y, w, h, { color: fg, size: 16, weight: 600, align: "center", fontFamily: "body" })];
}

function image(query: string, x: number, y: number, w: number, h: number, radius: number): ImageElement {
  return { id: newId("el"), type: "image", query, alt: "", fit: "cover", radius, position: "50% 50%", overlay: 0, x, y, w, h, rotation: 0, z: nextZ(), locked: false, opacity: 1 };
}

function card(skin: Skin, x: number, y: number, w: number, h: number): Element {
  return shape("rect", skin.card, x, y, w, h, { stroke: skin.line, strokeWidth: 1, radius: skin.radius });
}

function eyebrow(skin: Skin, label: string, x: number, y: number, align: "left" | "right" = "left"): Element[] {
  return [shape("ellipse", skin.a1, x, y + 2, 14, 14, { stroke: skin.ink, strokeWidth: 1 }), text(label, align === "left" ? x + 26 : x, y, 460, 28, { color: skin.ink, size: 16, weight: 600, letterSpacing: 2, fontFamily: "body", align })];
}

function folio(skin: Skin, page: string): Element[] {
  return [
    text(skin.brand, 96, 1012, 500, 28, { color: skin.ink3, size: 14, weight: 500, letterSpacing: 1.5, fontFamily: "body" }),
    text(page, 1420, 1012, 404, 28, { color: skin.ink3, size: 14, weight: 500, letterSpacing: 1.5, fontFamily: "body", align: "right" }),
  ];
}

/** The flat decorative accent shapes used in a slide's top-right corner, per the pack's motif. */
function motif(skin: Skin, cx: number, cy: number): Element[] {
  switch (skin.motif) {
    case "circle-duo":
      return [shape("ellipse", skin.a1, cx - 220, cy - 160, 440, 440, { opacity: 0.9 }), shape("ellipse", skin.a2, cx - 60, cy + 180, 150, 150, { opacity: 0.85 })];
    case "ring":
      return [shape("ellipse", "transparent", cx - 260, cy - 180, 520, 520, { stroke: skin.a1, strokeWidth: 2 }), shape("ellipse", skin.a1, cx - 60, cy - 10, 150, 150, { opacity: 0.6 })];
    case "square-trio":
      return [shape("rect", skin.a3, cx - 160, cy - 220, 320, 320, { radius: 24 }), shape("ellipse", skin.a2, cx - 260, cy + 10, 220, 220), shape("rect", skin.a1, cx + 80, cy + 60, 180, 90, { radius: 12 })];
    case "sunset": {
      const stripes: Element[] = Array.from({ length: 7 }, (_, i) => line(cx - 220, cy + i * 24, 440, 6, skin.bg));
      return [shape("ellipse", skin.a1, cx - 220, cy - 220, 440, 440, {}), ...stripes];
    }
    case "circle-solo":
      return [shape("ellipse", skin.a1, cx - 220, cy - 160, 440, 440)];
  }
}

function auto(skin: Skin, type: string, pageStr: string): Slide {
  z = 0;
  switch (type) {
    case "cover":
      return {
        id: newId("slide"),
        layoutId: "cover",
        background: { kind: "solid", color: skin.bg },
        elements: [
          ...eyebrow(skin, skin.brand.toUpperCase(), 96, 72),
          text("&#8599;", 1800, 64, 48, 48, { color: skin.ink, size: 32, fontFamily: "body" }),
          ...motif(skin, 1480, 300),
          text("Strategy<br/>Briefing FY26", 96, 300, 1400, 440, { color: skin.ink, size: 128, weight: 700, letterSpacing: -3 }),
          text("October 2026", 96, 950, 360, 32, { color: skin.ink, size: 18, weight: 500, letterSpacing: 2, fontFamily: "body" }),
          text("A growth plan for the year ahead", 660, 950, 600, 36, { color: skin.ink2, size: 22, weight: 400, fontFamily: "body", align: "center" }),
          text(`${skin.brand.toLowerCase().replace(/\s+/g, "")}.co`, 1560, 950, 264, 32, { color: skin.ink, size: 18, weight: 500, letterSpacing: 2, fontFamily: "body", align: "right" }),
        ],
        notes: "",
      };
    case "agenda": {
      const items: [string, string][] = [["Where we stand", "03"], ["Market shift", "05"], ["The three bets", "08"], ["Resourcing", "12"], ["The ask", "14"]];
      const rows = items.flatMap(([title, page], i) => {
        const y = 420 + i * 86;
        return [line(96, y, 1728, 1, skin.line), text(String(i + 1).padStart(2, "0"), 96, y + 20, 100, 32, { color: skin.ink3, size: 18, weight: 400, letterSpacing: 2, fontFamily: "body" }), text(title, 300, y + 14, 1200, 50, { color: skin.ink, size: 40, weight: 600, letterSpacing: -1 }), text(page, 1680, y + 20, 144, 32, { color: skin.ink3, size: 18, weight: 400, fontFamily: "body", align: "right" })];
      });
      const lastY = 420 + items.length * 86;
      return {
        id: newId("slide"),
        layoutId: "blank",
        background: { kind: "solid", color: skin.bg },
        elements: [...eyebrow(skin, "AGENDA", 96, 96), text("What we'll cover", 96, 160, 900, 140, { color: skin.ink, size: 80, weight: 700, letterSpacing: -2 }), text("Five topics, thirty minutes, one decision at the end.", 96, 300, 700, 48, { color: skin.ink2, size: 24, weight: 400, fontFamily: "body" }), ...rows, line(96, lastY, 1728, 1, skin.line), ...folio(skin, pageStr)],
        notes: "",
      };
    }
    case "divider":
      return {
        id: newId("slide"),
        layoutId: "section",
        background: { kind: "solid", color: skin.bg },
        elements: [...eyebrow(skin, "PART ONE", 96, 96), ...motif(skin, 1500, 300), text("Where we<br/>stand today", 96, 560, 1200, 300, { color: skin.ink, size: 88, weight: 700, letterSpacing: -2 }), text("A quick read on the market, the numbers and what changed since the last review.", 96, 850, 820, 70, { color: skin.ink2, size: 24, weight: 400, fontFamily: "body" }), ...folio(skin, pageStr)],
        notes: "",
      };
    case "objectives": {
      const cols: [string, string, string][] = [
        ["01", "Focus", "We stop shipping sideways and commit to the two bets that move the number."],
        ["02", "Speed", "Every team ships on a two-week cycle, no exceptions through Q2."],
        ["03", "Proof", "Each bet carries one metric the whole company can see weekly."],
      ];
      const colW = 544;
      const gap = 48;
      const items = cols.flatMap(([num, title, body], i) => {
        const x = 96 + i * (colW + gap);
        return [...(i > 0 ? [line(x - gap / 2, 500, 1, 280, skin.line)] : []), text(num, x, 500, 100, 32, { color: skin.a1, size: 18, weight: 600, letterSpacing: 2, fontFamily: "body" }), text(title, x, 548, colW, 60, { color: skin.ink, size: 36, weight: 600, letterSpacing: -1 }), text(body, x, 620, colW - 20, 160, { color: skin.ink2, size: 22, weight: 400, fontFamily: "body" })];
      });
      return { id: newId("slide"), layoutId: "blank", background: { kind: "solid", color: skin.bg }, elements: [...eyebrow(skin, "OBJECTIVES", 96, 96), text("Three things have to be true", 96, 160, 1200, 140, { color: skin.ink, size: 64, weight: 700, letterSpacing: -2 }), ...items, ...folio(skin, pageStr)], notes: "" };
    }
    case "team": {
      const members: [string, string, string][] = [
        ["Mira Chen", "Head of Strategy", "portrait of a confident strategy lead, studio lighting"],
        ["Owen Park", "VP Product", "portrait of a product executive, studio lighting"],
        ["Sasha Rao", "VP Growth", "portrait of a growth executive, studio lighting"],
        ["Leo Fontaine", "Finance Lead", "portrait of a finance lead, studio lighting"],
      ];
      const colW = 384;
      const gap = 32;
      const items = members.flatMap(([name, role, query], i) => {
        const x = 96 + i * (colW + gap);
        return [image(query, x, 320, colW, 400, skin.radius), text(name, x, 744, colW, 48, { color: skin.ink, size: 28, weight: 600, letterSpacing: -1 }), text(role, x, 790, colW, 32, { color: skin.ink3, size: 16, weight: 400, fontFamily: "body", letterSpacing: 1 })];
      });
      return { id: newId("slide"), layoutId: "blank", background: { kind: "solid", color: skin.bg }, elements: [...eyebrow(skin, "THE TEAM", 96, 96), text("Who's in the room", 96, 160, 1000, 140, { color: skin.ink, size: 68, weight: 700, letterSpacing: -2 }), ...items, ...folio(skin, pageStr)], notes: "" };
    }
    case "quote":
      return {
        id: newId("slide"),
        layoutId: "blank",
        background: { kind: "solid", color: skin.bgAlt ?? skin.bg },
        elements: [
          text("&ldquo;", 96, 180, 300, 260, { color: skin.a1, size: 240, weight: 700, fontFamily: "display" }),
          text("We closed the quarter five days faster than plan, and every region was looking at the same numbers for the first time.", 96, 420, 1480, 320, { color: skin.ink, size: 52, weight: 600, letterSpacing: -1 }),
          line(96, 820, 96, 2, skin.a1),
          text("Mira Chen", 224, 800, 400, 44, { color: skin.ink, size: 28, weight: 600, letterSpacing: -1 }),
          text("HEAD OF STRATEGY", 224, 846, 400, 32, { color: skin.ink3, size: 16, weight: 500, letterSpacing: 2, fontFamily: "body" }),
          ...folio(skin, pageStr),
        ],
        notes: "",
      };
    case "data": {
      const chart: ChartElement = { id: newId("el"), type: "chart", kind: "bar", labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"], series: [{ name: "Bookings ($M)", values: [40, 55, 48, 60, 66, 72] }], x: 936, y: 320, w: 888, h: 540, rotation: 0, z: nextZ(), locked: false, opacity: 1 };
      return {
        id: newId("slide"),
        layoutId: "blank",
        background: { kind: "solid", color: skin.bg },
        elements: [
          ...eyebrow(skin, "WHERE WE STAND", 96, 96),
          text("The numbers behind the ask", 96, 160, 760, 170, { color: skin.ink, size: 56, weight: 700, letterSpacing: -2 }),
          text("4.2x", 96, 560, 500, 170, { color: skin.a1, size: 140, weight: 700, letterSpacing: -4 }),
          text("Pipeline growth since the last review", 96, 710, 520, 60, { color: skin.ink2, size: 24, weight: 400, fontFamily: "body" }),
          line(96, 800, 760, 1, skin.line),
          text("68%", 96, 832, 320, 92, { color: skin.ink, size: 68, weight: 700, letterSpacing: -2 }),
          text("Win rate on qualified deals", 96, 926, 340, 56, { color: skin.ink2, size: 18, weight: 400, fontFamily: "body" }),
          text("11", 456, 832, 320, 92, { color: skin.ink, size: 68, weight: 700, letterSpacing: -2 }),
          text("New logos this quarter", 456, 926, 340, 56, { color: skin.ink2, size: 18, weight: 400, fontFamily: "body" }),
          chart,
          ...folio(skin, pageStr),
        ],
        notes: "",
      };
    }
    case "kpi": {
      const kpis: [string, string, string][] = [["+42%", "4.2x", "Pipeline growth"], ["+9pt", "68%", "Win rate"], ["+11", "11", "New logos"], ["-3d", "5 days", "Time to close"], ["+18%", "92%", "Net revenue retention"], ["+6pt", "41", "NPS"]];
      const colW = 544;
      const rowH = 260;
      const items = kpis.flatMap(([delta, value, label], i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const x = 96 + col * colW;
        const y = 340 + row * rowH;
        return [...(col > 0 ? [line(x, y, 1, 220, skin.line)] : []), text(delta, x + (col > 0 ? 48 : 0), y, 200, 32, { color: skin.a2, size: 18, weight: 600, letterSpacing: 1, fontFamily: "body" }), text(value, x + (col > 0 ? 48 : 0), y + 40, colW - 48, 140, { color: skin.ink, size: 96, weight: 700, letterSpacing: -3 }), text(label, x + (col > 0 ? 48 : 0), y + 184, colW - 72, 48, { color: skin.ink2, size: 22, weight: 400, fontFamily: "body" })];
      });
      return { id: newId("slide"), layoutId: "blank", background: { kind: "solid", color: skin.bg }, elements: [...eyebrow(skin, "THE SCOREBOARD", 96, 96), text("Six numbers that matter", 96, 160, 1000, 100, { color: skin.ink, size: 56, weight: 700, letterSpacing: -2 }), ...items, ...folio(skin, pageStr)], notes: "" };
    }
    case "timeline": {
      const ms: [string, string, string][] = [
        ["2024", "Series A", "Closed our first institutional round and shipped v1."],
        ["Q1 2025", "100 customers", "Crossed triple digits with a self-serve motion."],
        ["Q3 2025", "Platform rebuild", "Replatformed onto the data layer powering this year's bets."],
        ["Q1 2026", "Series B", "Raised to fund the three bets in this deck."],
        ["Now", "FY26 push", "Executing the plan on the next few slides."],
      ];
      const colW = 326;
      const gap = 44;
      const items = ms.flatMap(([date, title, body], i) => {
        const x = 96 + i * (colW + gap);
        return [shape("ellipse", skin.bg, x, 300, 30, 30, { stroke: skin.a1, strokeWidth: 4 }), text(date, x, 360, colW, 32, { color: skin.ink3, size: 16, weight: 500, letterSpacing: 2, fontFamily: "body" }), text(title, x, 400, colW, 56, { color: skin.ink, size: 30, weight: 600, letterSpacing: -1 }), text(body, x, 460, colW - 10, 200, { color: skin.ink2, size: 18, weight: 400, fontFamily: "body" })];
      });
      return { id: newId("slide"), layoutId: "blank", background: { kind: "solid", color: skin.bg }, elements: [...eyebrow(skin, "TRACK RECORD", 96, 96), text("Four years, three inflections", 96, 160, 1000, 100, { color: skin.ink, size: 56, weight: 700, letterSpacing: -2 }), line(96, 300, 1728, 2, skin.line), ...items, ...folio(skin, pageStr)], notes: "" };
    }
    case "process": {
      const steps: [string, string, string][] = [
        ["01", "Focus", "Cut the roadmap to the two bets that move the number this half."],
        ["02", "Build", "Two-week cycles, one demo every Friday, no silent slips."],
        ["03", "Launch", "Ship to 10% of accounts first, watch the metric, then expand."],
        ["04", "Learn", "Weekly review of the one number that tells us if the bet worked."],
      ];
      const colW = 408;
      const gap = 32;
      const items = steps.flatMap(([num, title, body], i) => {
        const x = 96 + i * (colW + gap);
        return [card(skin, x, 320, colW, 420), text(num, x + 40, 360, 200, 110, { color: skin.a1, size: 84, weight: 700, letterSpacing: -2 }), text(title, x + 40, 490, colW - 80, 56, { color: skin.ink, size: 32, weight: 600, letterSpacing: -1 }), text(body, x + 40, 550, colW - 80, 160, { color: skin.ink2, size: 18, weight: 400, fontFamily: "body" })];
      });
      return { id: newId("slide"), layoutId: "blank", background: { kind: "solid", color: skin.bg }, elements: [...eyebrow(skin, "HOW WE SHIP", 96, 96), text("Four steps, every two weeks", 96, 160, 1000, 100, { color: skin.ink, size: 56, weight: 700, letterSpacing: -2 }), ...items, ...folio(skin, pageStr)], notes: "" };
    }
    case "pricing": {
      const tiers: [string, string, string, string[], boolean][] = [
        ["Starter", "$0", "/mo", ["Up to 3 seats", "Core workspace", "Community support"], false],
        ["Growth", "$49", "/seat/mo", ["Unlimited seats", "Brand kit and templates", "Priority support"], true],
        ["Enterprise", "Custom", "", ["SSO and audit log", "Dedicated success lead", "Custom contract terms"], false],
      ];
      const colW = 544;
      const gap = 48;
      const items = tiers.flatMap(([name, price, period, feats, hi], i) => {
        const x = 96 + i * (colW + gap);
        const h = hi ? 700 : 660;
        const y = hi ? 300 : 320;
        return [
          card(skin, x, y, colW, h),
          ...(hi ? [shape("rect", skin.a1, x, y, colW, h, { opacity: 0.1, radius: skin.radius }), ...pill("MOST POPULAR", x + colW - 260, y + 36, 220, 40, skin.onA, skin.a1)] : []),
          text(name.toUpperCase(), x + 56, y + 48, colW - 112, 32, { color: skin.ink2, size: 16, weight: 600, letterSpacing: 2, fontFamily: "body" }),
          text(`${price} ${period}`, x + 56, y + 90, colW - 112, 110, { color: skin.ink, size: 64, weight: 700, letterSpacing: -2 }),
          ...feats.flatMap((f, j) => [line(x + 56, y + 230 + j * 60, colW - 112, 1, skin.line), text(f, x + 56, y + 248 + j * 60, colW - 112, 44, { color: skin.ink2, size: 18, weight: 400, fontFamily: "body" })]),
        ];
      });
      return { id: newId("slide"), layoutId: "blank", background: { kind: "solid", color: skin.bg }, elements: [...eyebrow(skin, "PRICING", 96, 96), text("Simple plans that scale with you", 96, 160, 1000, 100, { color: skin.ink, size: 56, weight: 700, letterSpacing: -2 }), ...items, ...folio(skin, pageStr)], notes: "" };
    }
    case "statement":
      return {
        id: newId("slide"),
        layoutId: "quote",
        background: { kind: "solid", color: skin.bg },
        elements: [...eyebrow(skin, "THE BOTTOM LINE", 96, 96), text("One system, one number, one quarter to prove it.", 96, 360, 1600, 300, { color: skin.ink, size: 80, weight: 700, letterSpacing: -2 }), text("Everything in this deck rolls up to a single bet: unify the data, and the rest gets easier.", 96, 700, 980, 70, { color: skin.ink2, size: 26, weight: 400, fontFamily: "body" }), ...folio(skin, pageStr)],
        notes: "",
      };
    case "closing": {
      const contacts: [string, string][] = [["EMAIL", `hello@${skin.brand.toLowerCase().replace(/\s+/g, "")}.co`], ["DECK", `${skin.brand.toLowerCase().replace(/\s+/g, "")}.co/fy26`], ["NEXT", "Oct 30, 2026"]];
      const colW = 544;
      const gap = 48;
      const items = contacts.flatMap(([label, value], i) => {
        const x = 96 + i * (colW + gap);
        return [text(label, x, 880, colW, 28, { color: skin.ink3, size: 16, weight: 500, letterSpacing: 2, fontFamily: "body" }), text(value, x, 912, colW, 56, { color: skin.ink, size: 32, weight: 600, letterSpacing: -1 })];
      });
      return {
        id: newId("slide"),
        layoutId: "closing",
        background: { kind: "solid", color: skin.bg },
        elements: [text("&#8600;", 96, 64, 48, 48, { color: skin.ink, size: 32, fontFamily: "body" }), ...eyebrow(skin, "THANK YOU", 1584, 72, "right"), ...motif(skin, 440, 300), text("Let's<br/>build it", 420, 300, 1304, 440, { color: skin.ink, size: 128, weight: 700, letterSpacing: -3, align: "right" }), line(96, 856, 1728, 1, skin.line), ...items],
        notes: "",
      };
    }
    default:
      return { id: newId("slide"), layoutId: "blank", background: { kind: "solid", color: skin.bg }, elements: [text(type, 96, 96, 800, 100, { color: skin.ink })], notes: "" };
  }
}

function buildPack(id: string, title: string, category: "Business" | "Product" | "Education" | "Team", skin: Skin, types: string[]): TemplateDeckDef {
  const now = new Date().toISOString();
  const slides = types.map((type, i) => auto(skin, type, `${String(i + 1).padStart(2, "0")} / ${types.length}`));
  const deck: Deck = { id: newId("deck"), title, themeId: skin.themeId, slides, createdAt: now, updatedAt: now, meta: {}, version: 1 };
  return { id, title, category, deck };
}

export const STUDIO_PACKS: TemplateDeckDef[] = [
  buildPack("tmpl-brutalist-mono", "Brutalist Mono", "Business", { themeId: "brutalist-mono", brand: "Northlight Studio", bg: "#ededea", bgAlt: "#0b0b0b", ink: "#0b0b0b", ink2: "#2a2a2a", ink3: "#55554f", line: "#0b0b0b", card: "#ffffff", a1: "#3a5bff", a2: "#ff4d2e", a3: "#ffe14a", onA: "#0b0b0b", radius: 0, motif: "square-trio" }, ["cover", "agenda", "divider", "process", "kpi", "pricing", "statement", "closing"]),
  buildPack("tmpl-editorial-ivory", "Editorial Ivory", "Business", { themeId: "editorial-ivory", brand: "Northlight Studio", bg: "#f4efe6", bgAlt: "#17140f", ink: "#17140f", ink2: "#4a443a", ink3: "#6b6457", line: "rgba(23,20,15,0.2)", card: "rgba(23,20,15,0.035)", a1: "#c8321e", a2: "#1d3a5f", a3: "#a5650f", onA: "#f4efe6", radius: 4, motif: "circle-duo" }, ["cover", "agenda", "objectives", "quote", "data", "team", "closing"]),
  buildPack("tmpl-forest-calm", "Forest Calm", "Team", { themeId: "forest-calm", brand: "Northlight Studio", bg: "#0f2a22", bgAlt: "#123428", ink: "#f1ead9", ink2: "#c6d2c3", ink3: "#96a99b", line: "rgba(241,234,217,0.2)", card: "rgba(241,234,217,0.06)", a1: "#d9c27a", a2: "#6fb58a", a3: "#e58f6b", onA: "#0f2a22", radius: 20, motif: "circle-duo" }, ["cover", "agenda", "divider", "objectives", "team", "quote", "closing"]),
  buildPack("tmpl-glass-frost", "Glass Frost", "Product", { themeId: "glass-frost", brand: "Northlight Studio", bg: "#e4ecff", bgAlt: "#101733", ink: "#101733", ink2: "#39426a", ink3: "#555e86", line: "rgba(16,23,51,0.16)", card: "rgba(255,255,255,0.55)", a1: "#4a5cff", a2: "#a65cff", a3: "#0a7f88", onA: "#ffffff", radius: 18, motif: "circle-duo" }, ["cover", "agenda", "team", "data", "timeline", "pricing", "closing"]),
  buildPack("tmpl-luxe-noir", "Luxe Noir", "Business", { themeId: "luxe-noir", brand: "Northlight Studio", bg: "#0b0b0c", bgAlt: "#121214", ink: "#efe7d6", ink2: "#c9c1b0", ink3: "#968f80", line: "rgba(201,163,92,0.35)", card: "rgba(201,163,92,0.05)", a1: "#c9a35c", a2: "#e6c987", a3: "#c9a35c", onA: "#0b0b0c", radius: 0, motif: "ring" }, ["cover", "quote", "objectives", "team", "pricing", "closing"]),
  buildPack("tmpl-neon-grid", "Neon Grid", "Product", { themeId: "neon-grid", brand: "Northlight Studio", bg: "#07070f", bgAlt: "#0c0c18", ink: "#eaf6ff", ink2: "#b4c4d6", ink3: "#8496ab", line: "rgba(0,229,255,0.28)", card: "rgba(255,255,255,0.04)", a1: "#00e5ff", a2: "#ff2bd6", a3: "#b8ff3c", onA: "#07070f", radius: 4, motif: "ring" }, ["cover", "agenda", "process", "timeline", "kpi", "data", "quote", "closing"]),
  buildPack("tmpl-pop-blocks", "Pop Blocks", "Team", { themeId: "pop-blocks", brand: "Northlight Studio", bg: "#f6f0e4", bgAlt: "#111111", ink: "#111111", ink2: "#33312b", ink3: "#5e5a4f", line: "#111111", card: "#ffffff", a1: "#2d4bff", a2: "#ff4f9a", a3: "#087a5b", onA: "#ffffff", radius: 16, motif: "square-trio" }, ["cover", "agenda", "statement", "process", "data", "pricing", "team", "closing"]),
  buildPack("tmpl-sunset-retro", "Sunset Retro", "Business", { themeId: "sunset-retro", brand: "Northlight Studio", bg: "#1d0f2b", bgAlt: "#26123a", ink: "#fff1e0", ink2: "#e9cfc6", ink3: "#bf9fb0", line: "rgba(255,241,224,0.2)", card: "rgba(255,241,224,0.06)", a1: "#ff6b3d", a2: "#ff3d8b", a3: "#ffb347", onA: "#1d0f2b", radius: 12, motif: "sunset" }, ["cover", "agenda", "objectives", "quote", "kpi", "closing"]),
  buildPack("tmpl-swiss-minimal", "Swiss Minimal", "Product", { themeId: "swiss-minimal", brand: "Northlight Studio", bg: "#f7f7f5", bgAlt: "#111111", ink: "#111111", ink2: "#3a3a38", ink3: "#6a6a66", line: "#111111", card: "transparent", a1: "#e5231b", a2: "#111111", a3: "#e5231b", onA: "#ffffff", radius: 0, motif: "circle-solo" }, ["cover", "agenda", "divider", "objectives", "data", "kpi", "timeline", "team", "closing"]),
];
