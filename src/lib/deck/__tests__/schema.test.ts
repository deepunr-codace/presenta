import { describe, expect, it } from "vitest";
import {
  BrandSchema,
  DECK_IMPORT_LIMITS,
  DeckImportSchema,
  DeckSchema,
  ImageElementSchema,
  KIND_TO_LAYOUT,
  LayoutIdSchema,
  PatchOpSchema,
  SlideBackgroundSchema,
  SlideKindSchema,
  isSafeGradient,
  isSafeUrl,
} from "../schema";
import { makeDeck, text } from "./fixtures";

const PNG = "data:image/png;base64,iVBORw0KGgo=";

describe("isSafeUrl", () => {
  it("accepts https, http, blob and base64 image data URLs", () => {
    expect(isSafeUrl("https://example.com/a.png")).toBe(true);
    expect(isSafeUrl("http://localhost:3000/a.png")).toBe(true);
    expect(isSafeUrl("blob:http://localhost:3000/6f1a-ff")).toBe(true);
    expect(isSafeUrl(PNG)).toBe(true);
    expect(isSafeUrl("data:image/jpeg;base64,/9j/4AAQ")).toBe(true);
    expect(isSafeUrl("data:image/webp;base64,UklGR")).toBe(true);
    expect(isSafeUrl("data:image/gif;base64,R0lGOD")).toBe(true);
    expect(isSafeUrl("data:image/svg+xml;base64,PHN2Zz4=")).toBe(true);
    expect(isSafeUrl("DATA:IMAGE/PNG;BASE64,iVBOR")).toBe(true);
  });

  it("rejects every other scheme, text data URLs and control characters", () => {
    for (const bad of [
      "",
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "file:///etc/passwd",
      "ftp://example.com/a.png",
      "data:text/html;base64,PHNjcmlwdD4=",
      "data:image/svg+xml,<svg onload=alert(1)>",
      "data:image/png,notbase64",
      "data:application/octet-stream;base64,AAAA",
      "https://example.com/a.png\n",
      "https://exa mple.com/a.png",
      "//example.com/a.png",
      "a.png",
      "https:",
      "https://",
    ]) {
      expect(isSafeUrl(bad), bad).toBe(false);
    }
  });

  it("is enforced on image src, image backgrounds, logos and setImage ops; empty means none", () => {
    const img = { id: "i", type: "image", x: 0, y: 0, w: 10, h: 10 };
    expect(ImageElementSchema.safeParse({ ...img, src: PNG }).success).toBe(true);
    expect(ImageElementSchema.safeParse({ ...img, src: "" }).success).toBe(true);
    expect(ImageElementSchema.safeParse({ ...img }).success).toBe(true);
    expect(ImageElementSchema.safeParse({ ...img, src: "javascript:alert(1)" }).success).toBe(false);
    expect(SlideBackgroundSchema.safeParse({ kind: "image", src: "https://x.test/a.jpg" }).success).toBe(true);
    expect(SlideBackgroundSchema.safeParse({ kind: "image", src: "data:text/html,<b>" }).success).toBe(false);
    expect(BrandSchema.safeParse({ logoDataUrl: PNG }).success).toBe(true);
    expect(BrandSchema.safeParse({ logoDataUrl: "javascript:1" }).success).toBe(false);
    expect(PatchOpSchema.safeParse({ op: "setImage", slideIndex: 0, elementId: "e", src: "" }).success).toBe(true);
    expect(PatchOpSchema.safeParse({ op: "setImage", slideIndex: 0, elementId: "e", src: "file:///x" }).success).toBe(false);
  });
});

describe("gradient css", () => {
  it("accepts linear, radial and conic gradients without url() or quotes", () => {
    expect(isSafeGradient("linear-gradient(135deg, #0a1f44 0%, #1b5fd9 100%)")).toBe(true);
    expect(isSafeGradient("radial-gradient(900px 600px at 6% 96%, rgba(190,214,255,0.9), transparent 70%)")).toBe(true);
    expect(isSafeGradient("  conic-gradient(from 90deg, red, blue)")).toBe(true);
  });

  it("rejects anything that is not a gradient or could load a resource", () => {
    for (const bad of [
      "#fff",
      "url(https://evil.example/x.png)",
      "linear-gradient(red, blue), url(x.png)",
      "linear-gradient(red, blue) url(x)",
      "linear-gradient('red', blue)",
      'linear-gradient("red", blue)',
      "repeating-linear-gradient(red, blue)",
      "expression(alert(1))",
      "",
    ]) {
      expect(isSafeGradient(bad), bad).toBe(false);
      expect(SlideBackgroundSchema.safeParse({ kind: "gradient", css: bad }).success, bad).toBe(false);
    }
    expect(SlideBackgroundSchema.safeParse({ kind: "gradient", css: "linear-gradient(red, blue)" }).success).toBe(true);
  });
});

describe("DeckImportSchema", () => {
  it("accepts an ordinary deck exactly like DeckSchema", () => {
    const deck = makeDeck(3);
    expect(DeckImportSchema.parse(deck)).toEqual(DeckSchema.parse(deck));
  });

  it("rejects decks over the slide, element, html, src and notes bounds", () => {
    const base = makeDeck(1);
    const slide = base.slides[0];

    const manySlides = { ...base, slides: Array.from({ length: DECK_IMPORT_LIMITS.slides + 1 }, () => structuredClone(slide)) };
    expect(DeckImportSchema.safeParse(manySlides).error?.issues[0].message).toMatch(/at most 100 slides/);
    expect(DeckSchema.safeParse(manySlides).success).toBe(true);

    const manyElements = structuredClone(base);
    manyElements.slides[0].elements = Array.from({ length: DECK_IMPORT_LIMITS.elementsPerSlide + 1 }, (_, i) => text(`t${i}`, "body", 0, i));
    expect(DeckImportSchema.safeParse(manyElements).error?.issues[0].message).toMatch(/at most 200 elements/);

    const longHtml = structuredClone(base);
    longHtml.slides[0].elements = [text("x".repeat(DECK_IMPORT_LIMITS.html + 1), "body", 0, 0)];
    expect(DeckImportSchema.safeParse(longHtml).error?.issues[0].path).toEqual(["slides", 0, "elements", 0, "html"]);

    const longSrc = structuredClone(base);
    longSrc.slides[0].elements = [
      { id: "img", type: "image", src: `data:image/png;base64,${"A".repeat(DECK_IMPORT_LIMITS.src)}`, x: 0, y: 0, w: 1, h: 1, rotation: 0, z: 0, locked: false, opacity: 1, alt: "", fit: "cover", radius: 0, position: "50% 50%", overlay: 0 },
    ];
    expect(DeckImportSchema.safeParse(longSrc).error?.issues[0].message).toMatch(/image/);

    const longNotes = structuredClone(base);
    longNotes.slides[0].notes = "n".repeat(DECK_IMPORT_LIMITS.notes + 1);
    expect(DeckImportSchema.safeParse(longNotes).error?.issues[0].path).toEqual(["slides", 0, "notes"]);

    const bigLogo = structuredClone(base);
    bigLogo.meta.brand = { logoDataUrl: `data:image/png;base64,${"A".repeat(DECK_IMPORT_LIMITS.src)}` };
    expect(DeckImportSchema.safeParse(bigLogo).error?.issues[0].path).toEqual(["meta", "brand", "logoDataUrl"]);
  });
});

describe("KIND_TO_LAYOUT", () => {
  it("maps every SlideKind to a valid LayoutId", () => {
    const layoutIds = new Set<string>(LayoutIdSchema.options);
    for (const kind of SlideKindSchema.options) {
      expect(KIND_TO_LAYOUT[kind], kind).toBeDefined();
      expect(layoutIds.has(KIND_TO_LAYOUT[kind]), `${kind} → ${KIND_TO_LAYOUT[kind]}`).toBe(true);
    }
    expect(Object.keys(KIND_TO_LAYOUT).sort()).toEqual([...SlideKindSchema.options].sort());
  });
});
