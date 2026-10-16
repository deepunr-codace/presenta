import Anthropic from "@anthropic-ai/sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_MAX_RETRIES, AI_TIMEOUT_MS, claudeRevise, structuredOutputFormat, toAiError } from "../claude";
import { AiError, AiParseError, AiRefusedError } from "../errors";
import { makeDeck } from "@/lib/deck/__tests__/fixtures";
import { GenerationSchema, OutlineSchema, RevisionSchema, SuggestResponseSchema } from "@/lib/deck/schema";

describe("structuredOutputFormat", () => {
  it("builds a schema the SDK transform accepts for every AI schema (tuples included)", () => {
    for (const schema of [GenerationSchema, OutlineSchema, RevisionSchema, SuggestResponseSchema]) {
      const format = structuredOutputFormat(schema);
      expect(format.type).toBe("json_schema");
      expect(JSON.stringify(format.schema)).not.toContain('"items":false');
      expect(JSON.stringify(format.schema)).not.toContain('"items":true');
    }
    const content = JSON.stringify(structuredOutputFormat(GenerationSchema).schema);
    expect(content).toContain("columnTitles");
    expect(content).toContain("prefixItems");
  });

  it("parses valid answers and raises AiParseError for invalid JSON or schema misses", () => {
    const format = structuredOutputFormat(RevisionSchema, "custom parse message");
    expect(format.parse(JSON.stringify({ summary: "ok", ops: [{ op: "setTitle", title: "T" }] }))).toEqual({ summary: "ok", ops: [{ op: "setTitle", title: "T" }] });
    expect(() => format.parse("{not json")).toThrow(AiParseError);
    expect(() => format.parse(JSON.stringify({ summary: "ok", ops: [{ op: "explode" }] }))).toThrow("custom parse message");
  });
});

const ZOD_STYLE_MESSAGE =
  "Failed to parse structured output: Invalid input\nValidation issues:\n  - ops.0.op: Invalid option: expected one of ...\n  - summary: Too big";

describe("toAiError", () => {
  it("turns the SDK's structured-output parse failure into AiParseError without the issue list", () => {
    const err = toAiError(new Anthropic.AnthropicError(ZOD_STYLE_MESSAGE), "Claude returned a revision that could not be parsed. Please try again.");
    expect(err).toBeInstanceOf(AiParseError);
    expect(err.code).toBe("parse");
    expect(err.message).toBe("Claude returned a revision that could not be parsed. Please try again.");
    expect(err.message).not.toMatch(/Validation issues|ops\.0|Invalid option/);
  });

  it("maps the other SDK errors to stable codes and plain messages", () => {
    const headers = new Headers();
    expect(toAiError(new Anthropic.AuthenticationError(401, undefined, "bad key", headers)).code).toBe("auth");
    expect(toAiError(new Anthropic.RateLimitError(429, undefined, "slow down", headers)).code).toBe("rate_limit");
    expect(toAiError(new Anthropic.APIConnectionError({ message: "ECONNRESET" })).code).toBe("network");
    expect(toAiError(new Anthropic.APIConnectionTimeoutError()).message).toMatch(/took too long/);
    expect(toAiError(new Anthropic.APIUserAbortError()).message).toMatch(/cancelled/);
    const api = toAiError(new Anthropic.InternalServerError(500, { type: "overloaded_error", message: "internal detail" }, "internal detail", headers));
    expect(api.code).toBe("api");
    expect(api.message).toBe("The Claude API returned an error (HTTP 500).");
    expect(api.message).not.toContain("internal detail");
  });

  it("never forwards the message of an unknown error", () => {
    const err = toAiError(new Error("ZodError: issues [...]"));
    expect(err).toBeInstanceOf(AiError);
    expect(err.code).toBe("api");
    expect(err.message).toBe("Unexpected error while calling Claude.");
    expect(toAiError(new AiRefusedError())).toBeInstanceOf(AiRefusedError);
  });
});

type ParseResult = { stop_reason: string; parsed_output: unknown };

describe("claudeRevise", () => {
  const parseSpy = vi.spyOn(Anthropic.Messages.prototype, "parse");
  let seenOptions: unknown;
  let seenClient: { timeout?: number; maxRetries?: number } | undefined;

  function answer(result: ParseResult) {
    parseSpy.mockImplementation(function (this: { _client?: { timeout?: number; maxRetries?: number } }, _params, options) {
      seenOptions = options;
      seenClient = this._client;
      return Promise.resolve(result) as never;
    });
  }

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    seenOptions = undefined;
    seenClient = undefined;
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    parseSpy.mockReset();
  });

  it("creates the client with a 55 s timeout and one retry, and forwards the abort signal", async () => {
    answer({ stop_reason: "end_turn", parsed_output: { summary: "ok", ops: [] } });
    const ctrl = new AbortController();
    const out = await claudeRevise({ deck: makeDeck(1), instruction: "x" }, { signal: ctrl.signal });
    expect(out).toEqual({ summary: "ok", ops: [] });
    expect(seenOptions).toEqual({ signal: ctrl.signal });
    expect(seenClient?.timeout).toBe(AI_TIMEOUT_MS);
    expect(seenClient?.maxRetries).toBe(AI_MAX_RETRIES);
    expect(AI_TIMEOUT_MS).toBe(55_000);
    expect(AI_MAX_RETRIES).toBe(1);
  });

  it("reports a truncated answer (stop_reason max_tokens) as a parse error with a clear message", async () => {
    answer({ stop_reason: "max_tokens", parsed_output: { summary: "partial", ops: [] } });
    const err = await claudeRevise({ deck: makeDeck(1), instruction: "x" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AiParseError);
    expect((err as AiError).message).toMatch(/ran out of room/);
  });

  it("maps a refusal and a missing parsed_output", async () => {
    answer({ stop_reason: "refusal", parsed_output: null });
    await expect(claudeRevise({ deck: makeDeck(1), instruction: "x" })).rejects.toBeInstanceOf(AiRefusedError);
    answer({ stop_reason: "end_turn", parsed_output: null });
    await expect(claudeRevise({ deck: makeDeck(1), instruction: "x" })).rejects.toBeInstanceOf(AiParseError);
  });

  it("maps a thrown SDK parse error to AiParseError", async () => {
    parseSpy.mockImplementation(() => Promise.reject(new Anthropic.AnthropicError(ZOD_STYLE_MESSAGE)) as never);
    const err = await claudeRevise({ deck: makeDeck(1), instruction: "x" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AiParseError);
    expect((err as AiError).message).not.toContain("Validation issues");
  });
});
