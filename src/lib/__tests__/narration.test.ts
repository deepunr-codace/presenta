import { describe, expect, test } from "vitest";
import { SlideSchema, type Slide } from "@/lib/deck/schema";
import { NARRATION_MAX_CHARS, narrationText } from "@/lib/narration";

/** A slide parsed through the schema, so every element gets its defaults. */
function slide(input: unknown): Slide {
  const raw = input as { elements?: Record<string, unknown>[] } & Record<string, unknown>;
  const elements = (raw.elements ?? []).map((el, i) => ({ id: `el_${i}`, ...el }));
  return SlideSchema.parse({ id: "slide_1", layoutId: "blank", ...raw, elements });
}

const text = (html: string, x = 0, y = 0) => ({ type: "text", role: "body", html, x, y, w: 100, h: 50 });

describe("narrationText", () => {
  test("reads the speaker notes when there are any", () => {
    const s = slide({ notes: "Welcome everyone. Today we look at the numbers.", elements: [text("<p>Slide title</p>")] });
    expect(narrationText(s)).toBe("Welcome everyone. Today we look at the numbers.");
  });

  test("keeps notes paragraphs as separate sentences", () => {
    const s = slide({ notes: "First point\nSecond point\n\nThird point." });
    expect(narrationText(s)).toBe("First point. Second point. Third point.");
  });

  test("falls back to the slide text in reading order", () => {
    const s = slide({
      elements: [
        text("<p>Bottom line</p>", 0, 400),
        text("<p>Quarterly review</p>", 200, 100),
        text("<p>Growth</p>", 0, 120),
      ],
    });
    expect(narrationText(s)).toBe("Quarterly review. Growth. Bottom line.");
  });

  test("turns bullet lines into sentences", () => {
    const s = slide({ elements: [text("<ul><li>Faster setup</li><li>Lower cost</li></ul>")] });
    expect(narrationText(s)).toBe("Faster setup. Lower cost.");
  });

  test("reads card values, titles and bodies", () => {
    const s = slide({ elements: [{ type: "card", x: 0, y: 0, w: 300, h: 200, value: "42%", title: "Growth", body: "Year over year" }] });
    expect(narrationText(s)).toBe("42%. Growth. Year over year.");
  });

  test("describes a chart with its labels and series", () => {
    const s = slide({
      elements: [{ type: "chart", x: 0, y: 0, w: 600, h: 400, kind: "bar", labels: ["Q1", "Q2"], series: [{ name: "Revenue", values: [10, 24] }] }],
    });
    expect(narrationText(s)).toBe("Bar chart. Labels: Q1, Q2. Revenue 10, 24.");
  });

  test("reads image alt text but skips shapes and icons", () => {
    const s = slide({
      elements: [
        { type: "shape", kind: "rect", x: 0, y: 0, w: 10, h: 10 },
        { type: "image", x: 0, y: 50, w: 10, h: 10, alt: "A team around a table" },
        { type: "icon", name: "Rocket", x: 0, y: 100, w: 10, h: 10 },
      ],
    });
    expect(narrationText(s)).toBe("A team around a table.");
  });

  test("never repeats the same line twice", () => {
    const s = slide({ elements: [text("<p>Same words</p>", 0, 0), text("<p>Same words</p>", 0, 200)] });
    expect(narrationText(s)).toBe("Same words.");
  });

  test("is empty for a slide with nothing to say", () => {
    expect(narrationText(slide({ elements: [] }))).toBe("");
    expect(narrationText(undefined)).toBe("");
  });

  test("cuts very long notes at a word boundary", () => {
    const s = slide({ notes: "word ".repeat(600) });
    const out = narrationText(s);
    expect(out.length).toBeLessThanOrEqual(NARRATION_MAX_CHARS + 1);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toContain("wor…");
  });

  test("decodes entities and collapses whitespace", () => {
    const s = slide({ elements: [text("<p>R&amp;D   budget</p>")] });
    expect(narrationText(s)).toBe("R&D budget.");
  });
});
