import { describe, expect, it } from "vitest";
import { COLUMN_SPLIT_X, deriveContent } from "../slide-text";
import { text } from "@/lib/deck/__tests__/fixtures";
import type { CardElement, Slide, TextElement } from "@/lib/deck/schema";

function slide(layoutId: Slide["layoutId"], elements: Slide["elements"]): Slide {
  return { id: "s", layoutId, background: { kind: "theme", variant: "default" }, elements, notes: "" };
}

function at(el: TextElement, x: number, w = 800): TextElement {
  return { ...el, x, w };
}

function panel(title: string, x: number): CardElement {
  return { id: `card_${x}`, type: "card", variant: "outline", title, body: "", x, y: 290, w: 852, h: 694, rotation: 0, z: 1, locked: false, opacity: 1 };
}

describe("deriveContent columns", () => {
  it("splits bullet lists into bullets and bulletsRight by the stage centre line", () => {
    const left = at(text("<ul><li>L1</li><li>L2</li></ul>", "bullets", 400, 2), 96);
    const right = at(text("<ul><li>R1</li><li>R2</li></ul>", "bullets", 400, 3), COLUMN_SPLIT_X + 40);
    const c = deriveContent(slide("two-column", [text("Title", "title", 96, 0), left, right]));
    expect(c.kind).toBe("two-column");
    expect(c.title).toBe("Title");
    expect(c.bullets).toEqual(["L1", "L2"]);
    expect(c.bulletsRight).toEqual(["R1", "R2"]);
  });

  it("uses two headings or two title-only panels as columnTitles on column layouts", () => {
    const heads = deriveContent(
      slide("two-column", [
        text("T", "title", 96, 0),
        at(text("Before", "heading", 290, 1), 96),
        at(text("After", "heading", 290, 2), 1000),
        at(text("<ul><li>a</li></ul>", "bullets", 366, 3), 96),
        at(text("<ul><li>b</li></ul>", "bullets", 366, 4), 1000),
      ]),
    );
    expect(heads.columnTitles).toEqual(["Before", "After"]);
    expect(heads.body).toBeUndefined();

    const panels = deriveContent(
      slide("comparison", [
        text("T", "title", 96, 0),
        panel("Old", 96),
        panel("New", 972),
        at(text("<ul><li>a</li></ul>", "bullets", 410, 3), 136),
        at(text("<ul><li>b</li></ul>", "bullets", 410, 4), 1012),
      ]),
    );
    expect(panels.kind).toBe("comparison");
    expect(panels.columnTitles).toEqual(["Old", "New"]);
    expect(panels.cards).toBeUndefined();
    expect(panels.bullets).toEqual(["a"]);
    expect(panels.bulletsRight).toEqual(["b"]);
  });

  it("treats a single list on the right as the main list and keeps headings as body elsewhere", () => {
    const lone = deriveContent(slide("title-bullets", [text("T", "title", 96, 0), at(text("<ul><li>x</li></ul>", "bullets", 400, 1), 1100)]));
    expect(lone.bullets).toEqual(["x"]);
    expect(lone.bulletsRight).toBeUndefined();

    const cards = deriveContent(slide("three-cards", [text("T", "title", 96, 0), { ...panel("Only title", 96), variant: "surface" }]));
    expect(cards.cards).toEqual([{ title: "Only title", body: "" }]);
    expect(cards.columnTitles).toBeUndefined();

    const heading = deriveContent(slide("title-bullets", [text("T", "title", 96, 0), text("Sub heading", "heading", 300, 1)]));
    expect(heading.body).toBe("Sub heading");
  });
});
