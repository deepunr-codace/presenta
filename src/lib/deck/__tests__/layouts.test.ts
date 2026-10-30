import { describe, expect, it } from "vitest";
import { DeckSchema, GenerationSchema, LayoutIdSchema, STAGE_H, STAGE_W, ThemeIdSchema, type Element, type TextElement } from "../schema";
import { applyLayout, buildDeck, buildSlide, LAYOUTS, LOGO_BOX } from "../layouts";
import { getTheme, THEMES } from "../themes";
import { newId } from "../ids";
import { SAMPLE_DECK, SAMPLE_GENERATION } from "../sample";
import { deriveContent } from "@/lib/ai/slide-text";
import { htmlToRuns } from "@/lib/export/pptx";

const theme = getTheme("glass-contrast");
const layoutIds = LayoutIdSchema.options;

function overlaps(a: Element, b: Element): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

describe("newId", () => {
  it("produces 10-char ids with an optional prefix", () => {
    expect(newId()).toHaveLength(10);
    expect(newId("slide")).toMatch(/^slide_.{10}$/);
    expect(new Set(Array.from({ length: 200 }, () => newId())).size).toBe(200);
  });
});

describe("themes", () => {
  it("defines every theme id with matching id field", () => {
    for (const [id, t] of Object.entries(THEMES)) expect(t.id).toBe(id);
    expect(Object.keys(THEMES).sort()).toEqual([...ThemeIdSchema.options].sort());
  });
});

describe("LAYOUTS", () => {
  it("lists every layout id exactly once", () => {
    expect(LAYOUTS.map((l) => l.id).sort()).toEqual([...layoutIds].sort());
  });
});

describe("applyLayout", () => {
  for (const layoutId of layoutIds) {
    describe(layoutId, () => {
      SAMPLE_GENERATION.slides.forEach((content, i) => {
        it(`sample slide ${i} (${content.kind}) fits the stage without text overlap`, () => {
          const els = applyLayout(content, layoutId, theme);
          for (const el of els) {
            expect(el.w).toBeGreaterThan(0);
            expect(el.h).toBeGreaterThan(0);
            expect(el.x).toBeGreaterThanOrEqual(0);
            expect(el.y).toBeGreaterThanOrEqual(0);
            expect(el.x + el.w).toBeLessThanOrEqual(STAGE_W);
            expect(el.y + el.h).toBeLessThanOrEqual(STAGE_H);
          }
          expect(new Set(els.map((e) => e.id)).size).toBe(els.length);
          const texts = els.filter((e): e is TextElement => e.type === "text");
          for (let a = 0; a < texts.length; a++) {
            for (let b = a + 1; b < texts.length; b++) {
              expect(overlaps(texts[a], texts[b]), `${texts[a].role} overlaps ${texts[b].role}`).toBe(false);
            }
          }
          if (layoutId === "blank") expect(els).toEqual([]);
          else expect(els.length).toBeGreaterThan(0);
        });
      });
    });
  }

  it("uses draw-order z values and autoFit text", () => {
    const els = applyLayout(SAMPLE_GENERATION.slides[2], "title-bullets", theme);
    expect(els.map((e) => e.z)).toEqual(els.map((_, i) => i));
    for (const el of els) if (el.type === "text") expect(el.autoFit).toBe(true);
  });

  it("escapes html in plain text and emits list html for bullets", () => {
    const els = applyLayout({ kind: "bullets", title: "A & B <c>", bullets: ["x < y"] }, "title-bullets", theme);
    const title = els.find((e) => e.type === "text" && e.role === "title") as TextElement;
    const bullets = els.find((e) => e.type === "text" && e.role === "bullets") as TextElement;
    expect(title.html).toBe("A &amp; B &lt;c&gt;");
    expect(bullets.html).toBe("<ul><li>x &lt; y</li></ul>");
  });
});

describe("comparison layout", () => {
  const content = SAMPLE_GENERATION.slides.find((s) => s.kind === "comparison");
  if (!content) throw new Error("sample has no comparison slide");

  it("keeps card bodies plain text and puts each column's list in a bullets element", () => {
    const els = applyLayout(content, "comparison", theme);
    const cards = els.filter((e) => e.type === "card");
    expect(cards).toHaveLength(2);
    for (const card of cards) {
      expect(card.variant).toBe("outline");
      expect(card.body).toBe("");
      expect(card.body).not.toContain("<");
    }
    expect(cards.map((c) => c.title)).toEqual(content.columnTitles);
    const lists = els.filter((e): e is TextElement => e.type === "text" && e.role === "bullets");
    expect(lists).toHaveLength(2);
    expect(lists[0].html).toBe(`<ul>${content.bullets?.map((b) => `<li>${b}</li>`).join("")}</ul>`);
    expect(lists[1].html).toBe(`<ul>${content.bulletsRight?.map((b) => `<li>${b}</li>`).join("")}</ul>`);
    // Each list sits inside its panel, below the title row.
    for (const [i, list] of lists.entries()) {
      const card = cards[i];
      expect(list.x).toBeGreaterThan(card.x);
      expect(list.x + list.w).toBeLessThan(card.x + card.w);
      expect(list.y).toBeGreaterThan(card.y + 60);
      expect(list.y + list.h).toBeLessThan(card.y + card.h);
      expect(list.z).toBeGreaterThan(card.z);
    }
  });

  it("round-trips through deriveContent and exports as plain runs", () => {
    const slide = buildSlide(content, theme);
    delete slide.content;
    const derived = deriveContent(slide);
    expect(derived.kind).toBe("comparison");
    expect(derived.title).toBe(content.title);
    expect(derived.bullets).toEqual(content.bullets);
    expect(derived.bulletsRight).toEqual(content.bulletsRight);
    expect(derived.columnTitles).toEqual(content.columnTitles);
    expect(derived.cards).toBeUndefined();

    for (const el of slide.elements) {
      if (el.type === "text") {
        const runs = htmlToRuns(el.html);
        expect(runs.length).toBeGreaterThan(0);
        for (const run of runs) expect(run.text).not.toContain("<");
      } else if (el.type === "card") {
        expect(el.body).not.toContain("<");
        expect(el.title).not.toContain("<");
      }
    }
    const rightRuns = htmlToRuns((slide.elements.filter((e): e is TextElement => e.type === "text" && e.role === "bullets")[1]).html);
    expect(rightRuns.map((r) => r.text)).toEqual(content.bulletsRight);
    expect(rightRuns.every((r) => r.bullet)).toBe(true);
  });

  it("uses body as the left list when there are no bullets and escapes it", () => {
    const els = applyLayout({ kind: "comparison", title: "T", body: "A < B", columnTitles: ["x", "y"] }, "comparison", theme);
    const lists = els.filter((e): e is TextElement => e.type === "text" && e.role === "bullets");
    expect(lists).toHaveLength(1);
    expect(lists[0].html).toBe("<ul><li>A &lt; B</li></ul>");
  });
});

describe("buildSlide", () => {
  it("picks the default layout and alt background for cover, section, quote and closing", () => {
    const cover = buildSlide(SAMPLE_GENERATION.slides[0], theme);
    expect(cover.layoutId).toBe("cover");
    expect(cover.background).toEqual({ kind: "theme", variant: "alt" });
    const bullets = buildSlide(SAMPLE_GENERATION.slides[2], theme);
    expect(bullets.layoutId).toBe("title-bullets");
    expect(bullets.background).toEqual({ kind: "theme", variant: "default" });
    const quote = buildSlide(SAMPLE_GENERATION.slides[9], theme);
    expect(quote.background).toEqual({ kind: "theme", variant: "alt" });
    const forced = buildSlide(SAMPLE_GENERATION.slides[4], theme, "four-cards");
    expect(forced.layoutId).toBe("four-cards");
    expect(forced.content).toBe(SAMPLE_GENERATION.slides[4]);
  });
});

describe("buildDeck and SAMPLE_DECK", () => {
  it("sample generation respects the content limits", () => {
    expect(() => GenerationSchema.parse(SAMPLE_GENERATION)).not.toThrow();
  });

  it("validates with DeckSchema and round-trips unchanged", () => {
    const parsed = DeckSchema.parse(SAMPLE_DECK);
    expect(parsed).toEqual(SAMPLE_DECK);
    expect(SAMPLE_DECK.themeId).toBe("glass-contrast");
    expect(SAMPLE_DECK.slides).toHaveLength(12);
    expect(SAMPLE_DECK.id).toMatch(/^deck_/);
  });

  it("covers every slide kind", () => {
    const kinds = new Set(SAMPLE_GENERATION.slides.map((s) => s.kind));
    expect([...kinds].sort()).toEqual(
      ["bullets", "cards", "closing", "comparison", "cover", "image-text", "process", "quote", "section", "stats", "two-column"].sort(),
    );
  });

  it("places a brand logo on the cover and closing slides only", () => {
    const logo = "data:image/png;base64,iVBORw0KGgo=";
    const deck = buildDeck(SAMPLE_GENERATION, "paper", { brand: { company: "Acme", logoDataUrl: logo, accent: "#FF0000" } });
    expect(DeckSchema.parse(deck)).toEqual(deck);
    for (const slide of deck.slides) {
      const logos = slide.elements.filter((e) => e.type === "image" && e.src === logo);
      const expected = slide.content?.kind === "cover" || slide.content?.kind === "closing" ? 1 : 0;
      expect(logos, `${slide.content?.kind} logo count`).toHaveLength(expected);
      for (const el of logos) {
        expect(el).toMatchObject({ fit: "contain", radius: 0, alt: "Acme", ...LOGO_BOX });
        expect(el.z).toBe(Math.max(...slide.elements.map((e) => e.z)));
        for (const other of slide.elements) if (other.type === "text") expect(el.y + el.h).toBeLessThanOrEqual(other.y);
      }
    }
    const plain = buildDeck(SAMPLE_GENERATION, "paper", { brand: { company: "Acme" } });
    expect(plain.slides.flatMap((s) => s.elements).some((e) => e.type === "image" && e.src)).toBe(false);
  });

  it("builds fresh decks with unique slide and element ids", () => {
    const deck = buildDeck(SAMPLE_GENERATION, "midnight", { source: "paste" });
    expect(DeckSchema.parse(deck)).toEqual(deck);
    expect(deck.title).toBe(SAMPLE_GENERATION.title);
    expect(deck.meta).toEqual({ source: "paste" });
    expect(Date.parse(deck.createdAt)).not.toBeNaN();
    const ids = [...deck.slides.map((s) => s.id), ...deck.slides.flatMap((s) => s.elements.map((e) => e.id))];
    expect(new Set(ids).size).toBe(ids.length);
  });
});
