import { describe, expect, it } from "vitest";
import { applyStyleSource } from "../apply-style";
import { SAMPLE_DECK } from "../sample";
import { TEMPLATE_DECKS } from "../template-decks";

describe("applyStyleSource", () => {
  it("leaves the deck alone without a source", () => {
    expect(applyStyleSource(SAMPLE_DECK, null)).toBe(SAMPLE_DECK);
  });

  it("rebuilds every slide from the template's design, keeping the generated words", () => {
    const tpl = TEMPLATE_DECKS.find((t) => t.deck.slides[0].elements.some((e) => e.type === "shape"))!;
    const out = applyStyleSource(SAMPLE_DECK, { kind: "template", id: tpl.id });
    expect(out.slides).toHaveLength(SAMPLE_DECK.slides.length);
    expect(out.themeId).toBe(tpl.deck.themeId);
    expect(out.slides[0].background).toEqual(tpl.deck.slides[0].background);
    // The template's cover shapes come along; its sample words do not.
    const tplShapes = tpl.deck.slides[0].elements.filter((e) => e.type === "shape").length;
    expect(out.slides[0].elements.filter((e) => e.type === "shape").length).toBe(tplShapes);
    const words = (d: typeof SAMPLE_DECK, i: number) => d.slides[i].elements.flatMap((e) => (e.type === "text" ? [e.html.replace(/<[^>]+>/g, "")] : [])).join(" ");
    const title = SAMPLE_DECK.slides[0].elements.find((e) => e.type === "text" && e.role === "title");
    expect(words(out, 0)).toContain(title && title.type === "text" ? title.html.replace(/<[^>]+>/g, "") : "");
  });

  it("uses an image as the cover background", () => {
    const dataUrl = "data:image/jpeg;base64,/9j/4AAQ";
    const out = applyStyleSource(SAMPLE_DECK, { kind: "image", dataUrl });
    expect(out.slides[0].background).toMatchObject({ kind: "image", src: dataUrl });
    expect(out.slides[2].background).toEqual(SAMPLE_DECK.slides[2].background);
  });
});
