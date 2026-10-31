import { describe, expect, it } from "vitest";
import { applyStyleSource } from "../apply-style";
import { SAMPLE_DECK } from "../sample";
import { TEMPLATE_DECKS } from "../template-decks";

describe("applyStyleSource", () => {
  it("leaves the deck alone without a source", () => {
    expect(applyStyleSource(SAMPLE_DECK, null)).toBe(SAMPLE_DECK);
  });

  it("carries a template's cover artwork and backgrounds onto the deck", () => {
    const tpl = TEMPLATE_DECKS.find((t) => t.deck.slides[0].elements.some((e) => e.type === "shape"))!;
    const out = applyStyleSource(SAMPLE_DECK, { kind: "template", id: tpl.id });
    expect(out.slides).toHaveLength(SAMPLE_DECK.slides.length);
    expect(out.slides[0].background).toEqual(tpl.deck.slides[0].background);
    expect(out.slides[0].elements.length).toBeGreaterThan(SAMPLE_DECK.slides[0].elements.length);
    expect(out.slides[0].elements[0].z).toBeLessThan(0);
  });

  it("uses an image as the cover background", () => {
    const dataUrl = "data:image/jpeg;base64,/9j/4AAQ";
    const out = applyStyleSource(SAMPLE_DECK, { kind: "image", dataUrl });
    expect(out.slides[0].background).toMatchObject({ kind: "image", src: dataUrl });
    expect(out.slides[2].background).toEqual(SAMPLE_DECK.slides[2].background);
  });
});
