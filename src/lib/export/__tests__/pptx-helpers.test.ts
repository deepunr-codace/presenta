import { decodeEntities } from "@/lib/text";
import { describe, expect, it, vi } from "vitest";
import { fetchImageAsDataUrl, firstColor, fontFaceFor, htmlToRuns, resolveImageSources, sanitizeFileName, toHex } from "../pptx";
import { makeDeck } from "@/lib/deck/__tests__/fixtures";
import type { Deck } from "@/lib/deck/schema";

describe("htmlToRuns", () => {
  it("returns a single run for plain text", () => {
    expect(htmlToRuns("Hello world")).toEqual([{ text: "Hello world" }]);
  });

  it("marks bold and italic runs and ends paragraphs at block boundaries", () => {
    expect(htmlToRuns("<p>Hello <strong>bold</strong> and <em>soft</em></p><p>Next</p>")).toEqual([
      { text: "Hello " },
      { text: "bold", bold: true },
      { text: " and " },
      { text: "soft", italic: true, breakLine: true },
      { text: "Next" },
    ]);
  });

  it("turns list items into bulleted paragraphs", () => {
    expect(htmlToRuns("<ul><li><p>One</p></li><li><p>Two <b>2</b></p></li><li>Three</li></ul>")).toEqual([
      { text: "One", bullet: true, breakLine: true },
      { text: "Two ", bullet: true },
      { text: "2", bold: true, breakLine: true },
      { text: "Three", bullet: true },
    ]);
  });

  it("treats <br> as a paragraph break and decodes entities", () => {
    expect(htmlToRuns("Fish &amp; chips<br>caf&eacute; &#8212; &lt;ok&gt;")).toEqual([
      { text: "Fish & chips", breakLine: true },
      { text: "café — <ok>" },
    ]);
  });

  it("drops empty runs and whitespace between blocks", () => {
    expect(htmlToRuns("<p></p>\n<p>  </p>\n<p>Only</p>\n")).toEqual([{ text: "Only" }]);
    expect(htmlToRuns("")).toEqual([]);
  });
});

describe("decodeEntities", () => {
  it("handles named, decimal and hex entities", () => {
    expect(decodeEntities("&quot;a&quot; &#39;b&#39; &#x41;&nbsp;")).toBe('"a" \'b\' A ');
  });
});

describe("decodeEntities robustness", () => {
  it("does not throw on malformed or out-of-range references inside runs", () => {
    expect(htmlToRuns("<p>&#xZZ; &#1114112; &#; ok</p>")).toEqual([{ text: "&#xZZ; &#1114112; &#; ok" }]);
  });
});

describe("remote image prefetch", () => {
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const okFetch = (async () => new Response(png, { status: 200, headers: { "content-type": "image/png" } })) as unknown as typeof fetch;

  it("fetchImageAsDataUrl embeds a successful download and returns null on any failure", async () => {
    expect(await fetchImageAsDataUrl("https://img.test/a.png", okFetch)).toBe(`data:image/png;base64,${Buffer.from(png).toString("base64")}`);
    const failing = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    expect(await fetchImageAsDataUrl("https://img.test/a.png", failing)).toBeNull();
    const notFound = (async () => new Response("nope", { status: 404 })) as unknown as typeof fetch;
    expect(await fetchImageAsDataUrl("https://img.test/a.png", notFound)).toBeNull();
    const empty = (async () => new Response(new Uint8Array(0), { status: 200, headers: { "content-type": "image/png" } })) as unknown as typeof fetch;
    expect(await fetchImageAsDataUrl("https://img.test/a.png", empty)).toBeNull();
  });

  it("resolveImageSources fetches each remote source once, skips data URLs and never rejects", async () => {
    const deck: Deck = makeDeck(2);
    const img = (id: string, src: string, z: number) =>
      ({ id, type: "image", src, x: 0, y: 0, w: 10, h: 10, rotation: 0, z, locked: false, opacity: 1, alt: "", fit: "cover", radius: 0, position: "50% 50%", overlay: 0 }) as const;
    deck.slides[0].elements.push(img("a", "https://img.test/a.png", 5), img("b", "https://img.test/a.png", 6), img("c", "data:image/png;base64,iVBORw0KGgo=", 7));
    deck.slides[1].background = { kind: "image", src: "https://img.test/broken.jpg", overlay: 0.4 };
    const fetchFn = vi.fn(async (url: string) => {
      if (url.endsWith("broken.jpg")) throw new TypeError("Failed to fetch");
      return new Response(png, { status: 200, headers: { "content-type": "image/png" } });
    });
    const images = await resolveImageSources(deck, fetchFn as unknown as typeof fetch);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(images.get("https://img.test/a.png")).toMatch(/^data:image\/png;base64,/);
    expect(images.get("https://img.test/broken.jpg")).toBeNull();
    expect(images.has("data:image/png;base64,iVBORw0KGgo=")).toBe(false);
  });
});

describe("toHex", () => {
  const tokens = {
    accent: "#1B5FD9",
    muted: "rgba(70, 85, 120, 0.9)",
    surface: "linear-gradient(180deg,#FFFFFF 0%,#F1F6FF 100%)",
  };

  it("normalises hex colours", () => {
    expect(toHex("#abc", "000000")).toBe("AABBCC");
    expect(toHex("#AABBCC", "000000")).toBe("AABBCC");
    expect(toHex("#aabbcc80", "000000")).toBe("AABBCC");
  });

  it("converts rgb and rgba", () => {
    expect(toHex("rgb(110, 140, 205)", "000000")).toBe("6E8CCD");
    expect(toHex("rgba(110,140,205,0.55)", "000000")).toBe("6E8CCD");
    expect(toHex("rgb(0 0 0 / 50%)", "FFFFFF")).toBe("000000");
  });

  it("resolves named tokens and gradients", () => {
    expect(toHex("accent", "000000", tokens)).toBe("1B5FD9");
    expect(toHex("muted", "000000", tokens)).toBe("465578");
    expect(toHex("surface", "000000", tokens)).toBe("FFFFFF");
    expect(toHex("linear-gradient(135deg, rgba(37,78,255,0.45), transparent)", "000000")).toBe("254EFF");
  });

  it("falls back for unknown values", () => {
    expect(toHex(undefined, "#123456")).toBe("123456");
    expect(toHex("", "123456")).toBe("123456");
    expect(toHex("var(--deck-ink)", "0E1A3A")).toBe("0E1A3A");
    expect(toHex("nonsense", "0E1A3A", tokens)).toBe("0E1A3A");
    expect(toHex("transparent", "FFFFFF")).toBe("FFFFFF");
  });
});

describe("firstColor", () => {
  it("finds the first colour in a gradient", () => {
    expect(firstColor("radial-gradient(900px 600px at 6% 96%, rgba(190,214,255,0.9), transparent 70%)")).toBe("rgba(190,214,255,0.9)");
    expect(firstColor("linear-gradient(180deg,#094FFF 0%,#215FF2 55%)")).toBe("#094FFF");
    expect(firstColor("none")).toBeNull();
  });
});

describe("fontFaceFor", () => {
  it("maps next/font variables to installed faces", () => {
    expect(fontFaceFor("var(--font-inter-tight)")).toBe("Inter");
    expect(fontFaceFor("var(--font-dm)")).toBe("DM Sans");
    expect(fontFaceFor("var(--font-oswald)")).toBe("Oswald");
    expect(fontFaceFor('"Georgia", serif')).toBe("Georgia");
    expect(fontFaceFor("var(--font-unknown)")).toBe("Inter");
  });
});

describe("sanitizeFileName", () => {
  it("strips filesystem-unsafe characters", () => {
    expect(sanitizeFileName('Q3: "Plan" / Review?')).toBe("Q3 Plan Review");
    expect(sanitizeFileName("   ")).toBe("deck");
  });
});
