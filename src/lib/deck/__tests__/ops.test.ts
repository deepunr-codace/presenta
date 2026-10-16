import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CardElement, Deck, ImageElement, PatchOp, ShapeElement } from "@/lib/deck/schema";

vi.mock("@/lib/deck/layouts", async () => {
  const f = await import("./fixtures");
  return { applyLayout: f.stubApplyLayout, buildSlide: f.stubBuildSlide };
});
vi.mock("@/lib/deck/ids", async () => {
  const f = await import("./fixtures");
  return { newId: f.stubNewId };
});

import { applyOps, BOX_MAX, BOX_MIN, DUPLICATE_OFFSET, MAX_SLIDES } from "@/lib/deck/ops";
import { makeContent, makeDeck, makeTheme, resetIds, text } from "./fixtures";

const theme = makeTheme();

describe("applyOps", () => {
  beforeEach(() => resetIds());

  it("returns a new deck and never mutates the input", () => {
    const deck = makeDeck(3);
    const snapshot = JSON.stringify(deck);
    const out = applyOps(deck, [{ op: "setTitle", title: "Changed" }, { op: "deleteSlide", slideIndex: 0 }], theme);
    expect(out).not.toBe(deck);
    expect(out.title).toBe("Changed");
    expect(out.slides).toHaveLength(2);
    expect(JSON.stringify(deck)).toBe(snapshot);
  });

  it("applies no ops as an identity copy", () => {
    const deck = makeDeck(2);
    const out = applyOps(deck, [], theme);
    expect(out).toEqual(deck);
    expect(out).not.toBe(deck);
  });

  it("replaceSlideContent rebuilds the slide but keeps its id", () => {
    const deck = makeDeck(3);
    const keepId = deck.slides[1].id;
    const content = makeContent("Replaced", "quote");
    const out = applyOps(deck, [{ op: "replaceSlideContent", slideIndex: 1, content }], theme);
    expect(out.slides[1].id).toBe(keepId);
    expect(out.slides[1].content).toEqual(content);
    expect(out.slides[1].layoutId).toBe("quote");
    expect(out.slides[1].elements[0]).toMatchObject({ type: "text", html: "Replaced [quote]" });
    expect(out.slides).toHaveLength(3);
  });

  it("replaceSlideContent ignores an out-of-range index", () => {
    const deck = makeDeck(2);
    const out = applyOps(deck, [{ op: "replaceSlideContent", slideIndex: 5, content: makeContent("x") }], theme);
    expect(out).toEqual(deck);
  });

  it("insertSlide inserts a built slide at the index", () => {
    const deck = makeDeck(2);
    const out = applyOps(deck, [{ op: "insertSlide", atIndex: 1, content: makeContent("Inserted", "stats") }], theme);
    expect(out.slides).toHaveLength(3);
    expect(out.slides[1].layoutId).toBe("stats-row");
    expect(out.slides[1].content?.title).toBe("Inserted");
    expect(out.slides[1].id).not.toBe(deck.slides[0].id);
    expect(out.slides[1].id).not.toBe(deck.slides[1].id);
    expect(out.slides[0].id).toBe(deck.slides[0].id);
    expect(out.slides[2].id).toBe(deck.slides[1].id);
  });

  it("insertSlide at or beyond the end appends", () => {
    const deck = makeDeck(2);
    const atEnd = applyOps(deck, [{ op: "insertSlide", atIndex: 2, content: makeContent("End") }], theme);
    expect(atEnd.slides[2].content?.title).toBe("End");
    const beyond = applyOps(deck, [{ op: "insertSlide", atIndex: 99, content: makeContent("Beyond") }], theme);
    expect(beyond.slides).toHaveLength(3);
    expect(beyond.slides[2].content?.title).toBe("Beyond");
  });

  it("deleteSlide removes the slide, ignores out-of-range and keeps the last slide", () => {
    const deck = makeDeck(3);
    const second = deck.slides[1].id;
    const out = applyOps(deck, [{ op: "deleteSlide", slideIndex: 1 }], theme);
    expect(out.slides.map((s) => s.id)).not.toContain(second);
    expect(out.slides).toHaveLength(2);

    expect(applyOps(deck, [{ op: "deleteSlide", slideIndex: 3 }], theme).slides).toHaveLength(3);
    expect(applyOps(deck, [{ op: "deleteSlide", slideIndex: -1 }], theme).slides).toHaveLength(3);

    const one = makeDeck(1);
    expect(applyOps(one, [{ op: "deleteSlide", slideIndex: 0 }], theme).slides).toHaveLength(1);
  });

  it("moveSlide reorders and ignores out-of-range", () => {
    const deck = makeDeck(4);
    const ids = deck.slides.map((s) => s.id);
    const out = applyOps(deck, [{ op: "moveSlide", fromIndex: 0, toIndex: 2 }], theme);
    expect(out.slides.map((s) => s.id)).toEqual([ids[1], ids[2], ids[0], ids[3]]);
    const back = applyOps(out, [{ op: "moveSlide", fromIndex: 2, toIndex: 0 }], theme);
    expect(back.slides.map((s) => s.id)).toEqual(ids);
    expect(applyOps(deck, [{ op: "moveSlide", fromIndex: 0, toIndex: 9 }], theme).slides.map((s) => s.id)).toEqual(ids);
    expect(applyOps(deck, [{ op: "moveSlide", fromIndex: 9, toIndex: 0 }], theme).slides.map((s) => s.id)).toEqual(ids);
  });

  it("setTitle changes only the title", () => {
    const deck = makeDeck(2);
    const out = applyOps(deck, [{ op: "setTitle", title: "New title" }], theme);
    expect(out.title).toBe("New title");
    expect(out.slides).toEqual(deck.slides);
    expect(out.themeId).toBe(deck.themeId);
  });

  it("setTheme changes only themeId", () => {
    const deck = makeDeck(2);
    const out = applyOps(deck, [{ op: "setTheme", themeId: "midnight" }], theme);
    expect(out.themeId).toBe("midnight");
    expect(out.slides).toEqual(deck.slides);
    expect(out.title).toBe(deck.title);
  });

  it("setLayout re-applies the layout from slide.content", () => {
    const deck = makeDeck(2);
    const out = applyOps(deck, [{ op: "setLayout", slideIndex: 1, layoutId: "two-column" }], theme);
    expect(out.slides[1].layoutId).toBe("two-column");
    expect(out.slides[1].elements[0]).toMatchObject({ html: "Slide 2 [two-column]" });
    expect(out.slides[1].id).toBe(deck.slides[1].id);
  });

  it("setLayout without content changes layoutId but leaves elements", () => {
    const deck = makeDeck(2);
    delete deck.slides[1].content;
    const before = structuredClone(deck.slides[1].elements);
    const out = applyOps(deck, [{ op: "setLayout", slideIndex: 1, layoutId: "blank" }], theme);
    expect(out.slides[1].layoutId).toBe("blank");
    expect(out.slides[1].elements).toEqual(before);
    expect(applyOps(deck, [{ op: "setLayout", slideIndex: 7, layoutId: "blank" }], theme)).toEqual(deck);
  });

  it("applies a sequence of ops in order", () => {
    const deck = makeDeck(3);
    const ops: PatchOp[] = [
      { op: "insertSlide", atIndex: 0, content: makeContent("Intro", "section") },
      { op: "moveSlide", fromIndex: 0, toIndex: 3 },
      { op: "setTitle", title: "Sequenced" },
      { op: "setTheme", themeId: "sky-facet" },
      { op: "deleteSlide", slideIndex: 0 },
      { op: "setLayout", slideIndex: 0, layoutId: "image-left" },
    ];
    const out = applyOps(deck, ops, theme);
    expect(out.title).toBe("Sequenced");
    expect(out.themeId).toBe("sky-facet");
    expect(out.slides).toHaveLength(3);
    expect(out.slides[2].content?.title).toBe("Intro");
    expect(out.slides[0].layoutId).toBe("image-left");
    expect(out.slides[0].content?.title).toBe("Slide 2");
  });
});

/* ---------- Element-level ops ---------- */

function image(id: string): ImageElement {
  return { id, type: "image", x: 100, y: 100, w: 600, h: 400, rotation: 0, z: 5, locked: false, opacity: 1, query: "old query", alt: "", fit: "cover", radius: 24, position: "50% 50%", overlay: 0 };
}

function card(id: string): CardElement {
  return { id, type: "card", x: 200, y: 200, w: 500, h: 300, rotation: 0, z: 6, locked: false, opacity: 1, variant: "surface", title: "Old title", body: "Old body", icon: "Rocket" };
}

function shape(id: string): ShapeElement {
  return { id, type: "shape", x: 0, y: 0, w: 100, h: 100, rotation: 0, z: 7, locked: true, opacity: 1, kind: "rect", fill: "accent", strokeWidth: 0, radius: 0 };
}

/** A three-slide deck whose second slide carries one element of every kind we patch. */
function elementDeck(): Deck {
  const deck = makeDeck(3);
  const title = { ...text("<p>Hello world</p>", "title", 96, 0), id: "t1", style: { fontSize: 72, color: "#111111" } };
  deck.slides[1].elements = [title, image("img1"), card("card1"), shape("shape1")];
  return deck;
}

function textOf(deck: Deck, slideIndex: number, id: string) {
  const el = deck.slides[slideIndex].elements.find((e) => e.id === id);
  if (el?.type !== "text") throw new Error(`expected text element ${id}`);
  return el;
}
function imageOf(deck: Deck, slideIndex: number, id: string) {
  const el = deck.slides[slideIndex].elements.find((e) => e.id === id);
  if (el?.type !== "image") throw new Error(`expected image element ${id}`);
  return el;
}
function cardOf(deck: Deck, slideIndex: number, id: string) {
  const el = deck.slides[slideIndex].elements.find((e) => e.id === id);
  if (el?.type !== "card") throw new Error(`expected card element ${id}`);
  return el;
}
function shapeOf(deck: Deck, slideIndex: number, id: string) {
  const el = deck.slides[slideIndex].elements.find((e) => e.id === id);
  if (el?.type !== "shape") throw new Error(`expected shape element ${id}`);
  return el;
}

describe("applyOps: element ops", () => {
  beforeEach(() => resetIds());

  it("setElementText replaces the html of a text element only", () => {
    const deck = elementDeck();
    const out = applyOps(deck, [{ op: "setElementText", slideIndex: 1, elementId: "t1", html: "<p>Changed</p>" }], theme);
    expect(textOf(out, 1, "t1").html).toBe("<p>Changed</p>");
    expect(textOf(deck, 1, "t1").html).toBe("<p>Hello world</p>");
    // Same slide, other elements untouched; other slides untouched.
    expect(out.slides[1].elements.filter((e) => e.id !== "t1")).toEqual(deck.slides[1].elements.filter((e) => e.id !== "t1"));
    expect(out.slides[0]).toEqual(deck.slides[0]);
    expect(out.slides[2]).toEqual(deck.slides[2]);
  });

  it("setElementText ignores non-text elements, unknown ids and out-of-range slides", () => {
    const deck = elementDeck();
    const ops: PatchOp[] = [
      { op: "setElementText", slideIndex: 1, elementId: "img1", html: "nope" },
      { op: "setElementText", slideIndex: 1, elementId: "missing", html: "nope" },
      { op: "setElementText", slideIndex: 9, elementId: "t1", html: "nope" },
    ];
    expect(applyOps(deck, ops, theme)).toEqual(deck);
  });

  it("setElementStyle merges typography and applies align / valign to the element", () => {
    const deck = elementDeck();
    const out = applyOps(deck, [{ op: "setElementStyle", slideIndex: 1, elementId: "t1", style: { fontSize: 80, fontWeight: 700, align: "center", valign: "middle" } }], theme);
    const el = textOf(out, 1, "t1");
    expect(el.style).toEqual({ fontSize: 80, fontWeight: 700, color: "#111111" });
    expect(el.align).toBe("center");
    expect(el.valign).toBe("middle");
    expect(el.html).toBe("<p>Hello world</p>");

    const colored = applyOps(out, [{ op: "setElementStyle", slideIndex: 1, elementId: "t1", style: { color: "#F05A3C", fontFamily: "display", lineHeight: 1.1, letterSpacing: -1 } }], theme);
    expect(textOf(colored, 1, "t1").style).toEqual({ fontSize: 80, fontWeight: 700, color: "#F05A3C", fontFamily: "display", lineHeight: 1.1, letterSpacing: -1 });
    expect(textOf(colored, 1, "t1").align).toBe("center");
  });

  it("setElementStyle is ignored on non-text elements, including align / valign", () => {
    const deck = elementDeck();
    const ops: PatchOp[] = [
      { op: "setElementStyle", slideIndex: 1, elementId: "img1", style: { color: "#ff0000", align: "center" } },
      { op: "setElementStyle", slideIndex: 1, elementId: "card1", style: { fontSize: 40, valign: "bottom" } },
      { op: "setElementStyle", slideIndex: 1, elementId: "shape1", style: { align: "right" } },
      { op: "setElementStyle", slideIndex: 1, elementId: "nope", style: { align: "right" } },
    ];
    expect(applyOps(deck, ops, theme)).toEqual(deck);
  });

  it("setElementBox updates only the given geometry fields and clamps opacity", () => {
    const deck = elementDeck();
    const out = applyOps(deck, [{ op: "setElementBox", slideIndex: 1, elementId: "img1", x: 10, w: 900, rotation: 15, opacity: 2 }], theme);
    const el = imageOf(out, 1, "img1");
    expect(el).toMatchObject({ x: 10, y: 100, w: 900, h: 400, rotation: 15, opacity: 1, radius: 24 });
    const partial = applyOps(deck, [{ op: "setElementBox", slideIndex: 1, elementId: "t1", y: 500, h: 200, opacity: -1 }], theme);
    expect(textOf(partial, 1, "t1")).toMatchObject({ x: 96, y: 500, w: 1728, h: 200, opacity: 0 });
    expect(applyOps(deck, [{ op: "setElementBox", slideIndex: 1, elementId: "ghost", x: 1 }], theme)).toEqual(deck);
    expect(applyOps(deck, [{ op: "setElementBox", slideIndex: 4, elementId: "img1", x: 1 }], theme)).toEqual(deck);
  });

  it("setElementBox.radius applies to images and shapes and is ignored elsewhere", () => {
    const deck = elementDeck();
    const out = applyOps(
      deck,
      [
        { op: "setElementBox", slideIndex: 1, elementId: "img1", radius: 48 },
        { op: "setElementBox", slideIndex: 1, elementId: "shape1", radius: 12 },
        { op: "setElementBox", slideIndex: 1, elementId: "t1", radius: 99 },
        { op: "setElementBox", slideIndex: 1, elementId: "card1", radius: 99 },
      ],
      theme,
    );
    expect(imageOf(out, 1, "img1").radius).toBe(48);
    expect(shapeOf(out, 1, "shape1").radius).toBe(12);
    expect(textOf(out, 1, "t1")).toEqual(textOf(deck, 1, "t1"));
    expect(cardOf(out, 1, "card1")).toEqual(cardOf(deck, 1, "card1"));
    expect("radius" in textOf(out, 1, "t1")).toBe(false);
  });

  it("setImage updates src, query, fit, overlay and position; empty src removes the picture", () => {
    const deck = elementDeck();
    const out = applyOps(deck, [{ op: "setImage", slideIndex: 1, elementId: "img1", src: "data:image/png;base64,AAAA", query: "new query", fit: "contain", overlay: 0.5, position: "top" }], theme);
    expect(imageOf(out, 1, "img1")).toMatchObject({ src: "data:image/png;base64,AAAA", query: "new query", fit: "contain", overlay: 0.5, position: "top", radius: 24 });

    const onlyQuery = applyOps(out, [{ op: "setImage", slideIndex: 1, elementId: "img1", query: "third" }], theme);
    expect(imageOf(onlyQuery, 1, "img1")).toMatchObject({ src: "data:image/png;base64,AAAA", query: "third", fit: "contain" });

    const removed = applyOps(onlyQuery, [{ op: "setImage", slideIndex: 1, elementId: "img1", src: "" }], theme);
    expect(imageOf(removed, 1, "img1").src).toBeUndefined();
    expect(imageOf(removed, 1, "img1").query).toBe("third");

    // Non-image targets and unknown ids are ignored.
    expect(applyOps(deck, [{ op: "setImage", slideIndex: 1, elementId: "t1", query: "x" }], theme)).toEqual(deck);
    expect(applyOps(deck, [{ op: "setImage", slideIndex: 1, elementId: "none", query: "x" }], theme)).toEqual(deck);
  });

  it("setCard updates the given fields; empty icon / value clear them", () => {
    const deck = elementDeck();
    const out = applyOps(deck, [{ op: "setCard", slideIndex: 1, elementId: "card1", title: "New title", variant: "accent", value: "42%" }], theme);
    expect(cardOf(out, 1, "card1")).toMatchObject({ title: "New title", body: "Old body", icon: "Rocket", variant: "accent", value: "42%" });

    const body = applyOps(out, [{ op: "setCard", slideIndex: 1, elementId: "card1", body: "New body", icon: "Star" }], theme);
    expect(cardOf(body, 1, "card1")).toMatchObject({ title: "New title", body: "New body", icon: "Star", value: "42%" });

    const cleared = applyOps(body, [{ op: "setCard", slideIndex: 1, elementId: "card1", icon: "", value: "" }], theme);
    expect(cardOf(cleared, 1, "card1").icon).toBeUndefined();
    expect(cardOf(cleared, 1, "card1").value).toBeUndefined();

    expect(applyOps(deck, [{ op: "setCard", slideIndex: 1, elementId: "t1", title: "x" }], theme)).toEqual(deck);
    expect(applyOps(deck, [{ op: "setCard", slideIndex: 1, elementId: "zzz", title: "x" }], theme)).toEqual(deck);
  });

  it("setSlideBackground replaces the background of one slide", () => {
    const deck = elementDeck();
    const out = applyOps(deck, [{ op: "setSlideBackground", slideIndex: 1, background: { kind: "solid", color: "#123456" } }], theme);
    expect(out.slides[1].background).toEqual({ kind: "solid", color: "#123456" });
    expect(out.slides[0].background).toEqual(deck.slides[0].background);
    expect(out.slides[1].elements).toEqual(deck.slides[1].elements);

    const gradient = applyOps(out, [{ op: "setSlideBackground", slideIndex: 1, background: { kind: "gradient", css: "linear-gradient(#000, #fff)" } }], theme);
    expect(gradient.slides[1].background).toEqual({ kind: "gradient", css: "linear-gradient(#000, #fff)" });
    expect(applyOps(deck, [{ op: "setSlideBackground", slideIndex: 3, background: { kind: "theme", variant: "alt" } }], theme)).toEqual(deck);
  });

  it("setSlideNotes replaces the notes of one slide", () => {
    const deck = elementDeck();
    const out = applyOps(deck, [{ op: "setSlideNotes", slideIndex: 2, notes: "Remember to pause here." }], theme);
    expect(out.slides[2].notes).toBe("Remember to pause here.");
    expect(out.slides[1].notes).toBe(deck.slides[1].notes);
    expect(applyOps(deck, [{ op: "setSlideNotes", slideIndex: -1, notes: "x" }], theme)).toEqual(deck);
  });

  it("deleteElement removes only that element and ignores unknown ids", () => {
    const deck = elementDeck();
    const out = applyOps(deck, [{ op: "deleteElement", slideIndex: 1, elementId: "card1" }], theme);
    expect(out.slides[1].elements.map((e) => e.id)).toEqual(["t1", "img1", "shape1"]);
    expect(deck.slides[1].elements).toHaveLength(4);
    expect(applyOps(deck, [{ op: "deleteElement", slideIndex: 1, elementId: "nope" }], theme)).toEqual(deck);
    expect(applyOps(deck, [{ op: "deleteElement", slideIndex: 7, elementId: "card1" }], theme)).toEqual(deck);
  });

  it("duplicateElement appends a copy with a new id, offset by 24 and on top", () => {
    const deck = elementDeck();
    const out = applyOps(deck, [{ op: "duplicateElement", slideIndex: 1, elementId: "shape1" }], theme);
    expect(out.slides[1].elements).toHaveLength(5);
    const original = shapeOf(out, 1, "shape1");
    const copy = out.slides[1].elements[4];
    if (copy.type !== "shape") throw new Error("expected shape copy");
    expect(copy.id).not.toBe("shape1");
    expect(copy.id).toMatch(/^el_/);
    expect(copy.x).toBe(original.x + DUPLICATE_OFFSET);
    expect(copy.y).toBe(original.y + DUPLICATE_OFFSET);
    expect(copy.z).toBe(8);
    expect(copy.locked).toBe(false);
    expect(copy).toMatchObject({ kind: "rect", fill: "accent", w: 100, h: 100 });
    expect(original).toEqual(deck.slides[1].elements[3]);

    const twice = applyOps(out, [{ op: "duplicateElement", slideIndex: 1, elementId: "t1" }], theme);
    const ids = twice.slides[1].elements.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(applyOps(deck, [{ op: "duplicateElement", slideIndex: 1, elementId: "ghost" }], theme)).toEqual(deck);
    expect(applyOps(deck, [{ op: "duplicateElement", slideIndex: 5, elementId: "t1" }], theme)).toEqual(deck);
  });

  it("element ops compose with slide ops in order", () => {
    const deck = elementDeck();
    const ops: PatchOp[] = [
      { op: "setElementText", slideIndex: 1, elementId: "t1", html: "First" },
      { op: "moveSlide", fromIndex: 1, toIndex: 0 },
      { op: "setElementStyle", slideIndex: 0, elementId: "t1", style: { align: "right" } },
      { op: "setSlideNotes", slideIndex: 0, notes: "moved" },
      { op: "duplicateElement", slideIndex: 0, elementId: "img1" },
      { op: "deleteElement", slideIndex: 0, elementId: "img1" },
    ];
    const out = applyOps(deck, ops, theme);
    expect(textOf(out, 0, "t1")).toMatchObject({ html: "First", align: "right" });
    expect(out.slides[0].notes).toBe("moved");
    const images = out.slides[0].elements.filter((e) => e.type === "image");
    expect(images).toHaveLength(1);
    expect(images[0].id).not.toBe("img1");
    expect(images[0].x).toBe(100 + DUPLICATE_OFFSET);
  });
});

describe("applyOps: hardening", () => {
  beforeEach(() => resetIds());

  it("insertSlide is skipped once the deck has MAX_SLIDES slides", () => {
    const full = makeDeck(MAX_SLIDES);
    const out = applyOps(full, [{ op: "insertSlide", atIndex: 3, content: makeContent("Extra") }], theme);
    expect(out.slides).toHaveLength(MAX_SLIDES);
    expect(out).toEqual(full);
    const almost = makeDeck(MAX_SLIDES - 1);
    const grown = applyOps(
      almost,
      [
        { op: "insertSlide", atIndex: 0, content: makeContent("One") },
        { op: "insertSlide", atIndex: 0, content: makeContent("Two") },
      ],
      theme,
    );
    expect(grown.slides).toHaveLength(MAX_SLIDES);
    expect(grown.slides[0].content?.title).toBe("One");
  });

  it("setElementBox clamps position, size, rotation and radius", () => {
    const deck = elementDeck();
    const out = applyOps(
      deck,
      [
        { op: "setElementBox", slideIndex: 1, elementId: "t1", x: -99999, y: 99999, w: 1e9, h: 0.0001, rotation: 1e6 },
        { op: "setElementBox", slideIndex: 1, elementId: "img1", x: 500, y: -1920, w: 3840, h: 1, rotation: -720, radius: 1e9 },
      ],
      theme,
    );
    expect(textOf(out, 1, "t1")).toMatchObject({ x: BOX_MIN, y: BOX_MAX, w: BOX_MAX, h: 1, rotation: 360 });
    const img = out.slides[1].elements.find((e) => e.id === "img1");
    expect(img).toMatchObject({ x: 500, y: -1920, w: 3840, h: 1, rotation: -360, radius: BOX_MAX });
  });

  it("setElementText sanitises model HTML: allowed tags stay, everything else goes", () => {
    const deck = elementDeck();
    const out = applyOps(
      deck,
      [
        {
          op: "setElementText",
          slideIndex: 1,
          elementId: "t1",
          html: '<p onclick="x()">Hi <strong>there</strong><img src=x onerror=alert(1)><script>alert(2)</script></p><ul><li>a</li></ul>',
        },
      ],
      theme,
    );
    expect(textOf(out, 1, "t1").html).toBe("<p>Hi <strong>there</strong></p><ul><li>a</li></ul>");
  });

  it("setCard strips tags from title and body", () => {
    const deck = elementDeck();
    const out = applyOps(deck, [{ op: "setCard", slideIndex: 1, elementId: "card1", title: "<b>Bold</b> title", body: 'Body <img src=x onerror="a()"> text' }], theme);
    const card = out.slides[1].elements.find((e) => e.id === "card1");
    expect(card).toMatchObject({ title: "Bold title", body: "Body  text" });
  });
});
