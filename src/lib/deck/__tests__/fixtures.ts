/**
 * Test-only fixtures and stand-ins for the Task 1 modules (themes, layouts,
 * ids). Tests wire these in through vi.mock so they do not depend on the
 * real layout engine.
 */
import {
  KIND_TO_LAYOUT,
  type Deck,
  type Element,
  type LayoutId,
  type Slide,
  type SlideContent,
  type TextElement,
  type Theme,
  type ThemeId,
} from "@/lib/deck/schema";

let counter = 0;
export function stubNewId(prefix = "id"): string {
  counter += 1;
  return `${prefix}_${counter.toString(36).padStart(6, "0")}`;
}
export function resetIds(): void {
  counter = 0;
}

export function makeTheme(id: ThemeId = "paper"): Theme {
  return {
    id,
    name: id,
    description: "test theme",
    fonts: { display: "Inter Tight", body: "Inter", displayWeight: 600, bodyWeight: 400, googleImport: "" },
    colors: {
      bg: "#fff",
      bgAlt: "#000",
      surface: "#fff",
      surfaceBorder: "#ddd",
      ink: "#111",
      muted: "#666",
      accent: "#0044ff",
      accentInk: "#fff",
      accentSoft: "#dde4ff",
      line: "#eee",
    },
    radius: 16,
    background: { default: "#fff", alt: "#000" },
    card: { fill: "#fff", border: "#ddd", shadow: "none", radius: 16 },
    swatch: ["#fff", "#0044ff"],
  };
}

export function stubGetTheme(id: ThemeId): Theme {
  return makeTheme(id);
}

export function text(html: string, role: TextElement["role"], y: number, z: number): TextElement {
  return {
    id: stubNewId("text"),
    type: "text",
    role,
    html,
    x: 96,
    y,
    w: 1728,
    h: 120,
    rotation: 0,
    z,
    locked: false,
    opacity: 1,
    align: "left",
    valign: "top",
    autoFit: true,
    style: {},
  };
}

export function stubApplyLayout(content: SlideContent, layoutId: LayoutId, theme: Theme): Element[] {
  void theme;
  const els: Element[] = [text(`${content.title} [${layoutId}]`, "title", 96, 0)];
  if (content.subtitle) els.push(text(content.subtitle, "subtitle", 240, 1));
  if (content.bullets?.length) els.push(text(content.bullets.join(" / "), "bullets", 400, 2));
  return els;
}

export function stubBuildSlide(content: SlideContent, theme: Theme, layoutId?: LayoutId): Slide {
  const id = layoutId ?? KIND_TO_LAYOUT[content.kind];
  const alt = content.kind === "cover" || content.kind === "section" || content.kind === "closing";
  return {
    id: stubNewId("slide"),
    layoutId: id,
    background: { kind: "theme", variant: alt ? "alt" : "default" },
    elements: stubApplyLayout(content, id, theme),
    notes: content.notes ?? "",
    content,
  };
}

export function makeContent(title: string, kind: SlideContent["kind"] = "bullets"): SlideContent {
  return { kind, title, bullets: kind === "bullets" ? ["a", "b"] : undefined };
}

export function makeDeck(slideCount = 3, id = "deck_test"): Deck {
  const theme = makeTheme();
  const slides: Slide[] = [];
  for (let i = 0; i < slideCount; i += 1) {
    slides.push(stubBuildSlide(makeContent(`Slide ${i + 1}`, i === 0 ? "cover" : "bullets"), theme));
  }
  return {
    id,
    title: "Test deck",
    themeId: "paper",
    slides,
    createdAt: "2026-09-15T00:00:00.000Z",
    updatedAt: "2026-09-15T00:00:00.000Z",
    meta: { source: "blank" },
    version: 1,
  };
}
