import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../revise/route";
import { exceedsUtf8Bytes, jsonFailure, MAX_BODY_BYTES } from "../_lib/respond";
import { AiError } from "@/lib/ai";
import { makeDeck } from "@/lib/deck/__tests__/fixtures";

function post(body: unknown): Promise<Response> {
  return POST(new Request("http://localhost/api/revise", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
}

describe("POST /api/revise selection validation", () => {
  afterEach(() => vi.restoreAllMocks());

  it("rejects selection.slideIndex outside the deck with 400", async () => {
    const deck = makeDeck(2);
    const res = await post({ deck, instruction: "shorten", selection: { slideIndex: 5 } });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toMatchObject({ ok: false, code: "invalid" });
    expect(json.error).toMatch(/selection\.slideIndex/);
  });

  it("rejects selection.elementId that is not on the selected slide with 400", async () => {
    const deck = makeDeck(2);
    const foreign = deck.slides[1].elements[0].id;
    const res = await post({ deck, instruction: "shorten", selection: { slideIndex: 0, elementId: foreign } });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/selection\.elementId/);
    const ghost = await post({ deck, instruction: "shorten", selection: { slideIndex: 0, elementId: "nope" } });
    expect(ghost.status).toBe(400);
  });

  it("accepts a selection that matches the deck", async () => {
    const deck = makeDeck(2);
    const el = deck.slides[1].elements[0];
    const res = await post({ deck, instruction: "make it punchier", selection: { slideIndex: 1, elementId: el.id, elementType: "text", role: "title" } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.source).toBe("mock");
    expect(Array.isArray(json.data.ops)).toBe(true);
  });

  it("still rejects selectedSlideIndex out of range", async () => {
    const res = await post({ deck: makeDeck(1), instruction: "x", selectedSlideIndex: 3 });
    expect(res.status).toBe(400);
  });
});

describe("jsonFailure", () => {
  it("returns only the fallback text for unexpected errors and the AiError message for known ones", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = jsonFailure(new Error("ENOENT /srv/secret/path"), "Unexpected error while revising the deck.");
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json).toEqual({ ok: false, code: "api", error: "Unexpected error while revising the deck." });
    expect(spy).toHaveBeenCalledTimes(1);

    const known = jsonFailure(new AiError("rate_limit", "Slow down."), "fallback");
    expect(known.status).toBe(502);
    expect(await known.json()).toEqual({ ok: false, code: "rate_limit", error: "Slow down." });
    spy.mockRestore();
  });
});

describe("exceedsUtf8Bytes", () => {
  it("counts multi-byte text correctly on every path", () => {
    expect(exceedsUtf8Bytes("abc", 3)).toBe(false);
    expect(exceedsUtf8Bytes("abcd", 3)).toBe(true);
    // Fast path: fewer code units than a third of the limit can never exceed it.
    expect(exceedsUtf8Bytes("é".repeat(10), 1000)).toBe(false);
    // Encoded band: 2-byte characters that fit by code units but not by bytes.
    expect(exceedsUtf8Bytes("é".repeat(600), 1000)).toBe(true);
    expect(exceedsUtf8Bytes("é".repeat(500), 1000)).toBe(false);
    // Fast path: more code units than the limit.
    expect(exceedsUtf8Bytes("a".repeat(MAX_BODY_BYTES + 1), MAX_BODY_BYTES)).toBe(true);
    expect(exceedsUtf8Bytes("a".repeat(MAX_BODY_BYTES), MAX_BODY_BYTES)).toBe(false);
  });
});
