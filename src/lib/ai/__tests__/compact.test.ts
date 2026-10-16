import { afterEach, describe, expect, it, vi } from "vitest";
import { compactDeckForRevise } from "../compact";
import { buildReviseUserMessage } from "../prompts";
import { postRevise, withDeadline } from "@/lib/api-client";
import { buildDeck } from "@/lib/deck/layouts";
import { SAMPLE_GENERATION } from "@/lib/deck/sample";
import { DeckSchema, type Deck } from "@/lib/deck/schema";

const MB = 1024 * 1024;
/** A 1.2 MB PNG data URL, base64 characters only so the schema accepts it. */
const BIG_LOGO = `data:image/png;base64,${"A".repeat(Math.ceil(1.2 * MB))}`;

function deckWithLogo(): Deck {
  const deck = buildDeck(SAMPLE_GENERATION, "paper", { brand: { company: "Acme", logoDataUrl: BIG_LOGO } });
  // A remote picture and an image background must survive compaction untouched.
  const img = deck.slides[2].elements.find((e) => e.type === "image");
  if (img && img.type === "image") img.src = "https://images.example/hero.jpg";
  deck.slides[3].background = { kind: "image", src: BIG_LOGO, overlay: 0.4 };
  return deck;
}

describe("compactDeckForRevise", () => {
  it("blanks every embedded data URL and leaves the original deck alone", () => {
    const deck = deckWithLogo();
    const before = JSON.stringify(deck);
    expect(before.length).toBeGreaterThan(3 * MB);

    const compact = compactDeckForRevise(deck);
    expect(JSON.stringify(deck)).toBe(before);
    expect(JSON.stringify(compact).length).toBeLessThan(1 * MB);
    expect(JSON.stringify(compact)).not.toContain("data:");
    expect(compact.meta.brand?.logoDataUrl).toBe("");
    expect(compact.slides[3].background).toEqual({ kind: "image", src: "", overlay: 0.4 });
    const logos = compact.slides.flatMap((s) => s.elements).filter((e) => e.type === "image" && e.alt === "Acme");
    expect(logos).toHaveLength(2);
    for (const logo of logos) expect(logo.type === "image" && logo.src).toBe("");
    const remote = compact.slides[2].elements.find((e) => e.type === "image");
    expect(remote?.type === "image" && remote.src).toBe("https://images.example/hero.jpg");
    expect(DeckSchema.parse(compact)).toEqual(compact);
  });

  it("keeps ids, text and content so ops computed against the compact deck apply to the original", () => {
    const deck = deckWithLogo();
    const compact = compactDeckForRevise(deck);
    expect(compact.slides.map((s) => s.id)).toEqual(deck.slides.map((s) => s.id));
    expect(compact.slides.map((s) => s.elements.map((e) => e.id))).toEqual(deck.slides.map((s) => s.elements.map((e) => e.id)));
    expect(compact.slides.map((s) => s.content)).toEqual(deck.slides.map((s) => s.content));
  });

  it("produces a revise user message without any data URL", () => {
    const deck = deckWithLogo();
    const message = buildReviseUserMessage({ deck: compactDeckForRevise(deck), instruction: "Shorten slide 2", selectedSlideIndex: 1 });
    expect(message).not.toContain("data:");
    expect(message.length).toBeLessThan(200_000);
  });
});

describe("postRevise", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("posts the compacted deck with a deadline signal", async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      void init;
      return new Response(JSON.stringify({ ok: true, data: { summary: "ok", ops: [] }, source: "mock" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const deck = deckWithLogo();
    const res = await postRevise({ deck, instruction: "Tighten the copy" });
    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/revise");
    const body = init?.body as string;
    expect(body.length).toBeLessThan(1 * MB);
    expect(body).not.toContain("data:");
    expect(JSON.parse(body).instruction).toBe("Tighten the copy");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    // The caller's deck is untouched.
    expect(deck.meta.brand?.logoDataUrl).toBe(BIG_LOGO);
  });

  it("withDeadline combines the caller's signal with a timeout", () => {
    const ctrl = new AbortController();
    const combined = withDeadline(ctrl.signal, 10_000);
    expect(combined).toBeInstanceOf(AbortSignal);
    expect(combined?.aborted).toBe(false);
    ctrl.abort();
    expect(combined?.aborted).toBe(true);
    expect(withDeadline(undefined, 10_000)).toBeInstanceOf(AbortSignal);
  });

  it("reports a timeout as a network failure, not a crash", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new DOMException("The operation timed out.", "TimeoutError");
    }) as unknown as typeof fetch;
    const res = await postRevise({ deck: deckWithLogo(), instruction: "x" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("network");
      expect(res.error).toMatch(/did not answer within 90 seconds/);
    }
  });
});
