import Anthropic from "@anthropic-ai/sdk";
import type { AutoParseableOutputFormat } from "@anthropic-ai/sdk/lib/parser";
import { transformJSONSchema, type JSONSchema } from "@anthropic-ai/sdk/lib/transform-json-schema";
import { z } from "zod";
import {
  GenerationSchema,
  OutlineSchema,
  RevisionSchema,
  SuggestResponseSchema,
  type GenerateRequest,
  type Generation,
  type Outline,
  type OutlineRequest,
  type ReviseRequest,
  type Revision,
  type SuggestRequest,
  type SuggestResponse,
} from "@/lib/deck/schema";
import { SMART_PAGE_SYSTEM, SmartPageSchema, buildSmartPageUserText, type SmartPage, type SmartPageRequest } from "@/lib/import/smart-schema";
import type { AiAuth } from "./auth";
import { AiError, AiParseError, AiRefusedError } from "./errors";
import {
  GENERATE_SYSTEM,
  OUTLINE_SYSTEM,
  REVISE_SYSTEM,
  SUGGEST_SYSTEM,
  buildGenerateUserMessage,
  buildOutlineUserMessage,
  buildReviseUserMessage,
  buildSuggestUserMessage,
} from "./prompts";

export const AI_MODEL = "claude-opus-5";
const MAX_TOKENS = 16000;

/** One attempt may take this long; the route's own deadline is longer, the browser's is 90 s. */
export const AI_TIMEOUT_MS = 55_000;
export const AI_MAX_RETRIES = 1;

/** Per-call options shared by every AI entry point. The offline mock ignores them. */
export type AiCallOptions = {
  /** Aborts the upstream request when the client goes away (`request.signal` in a route). */
  signal?: AbortSignal;
  /** The visitor's own key; when absent the server's ANTHROPIC_API_KEY is used. */
  auth?: AiAuth;
};

let client: Anthropic | null = null;

/**
 * Drop boolean `items` subschemas (`items: false`, which zod emits after
 * `prefixItems` for tuples such as `columnTitles`). The SDK's schema
 * transform rejects boolean subschemas; `minItems`/`maxItems` already fix the
 * tuple length and zod re-validates the answer, so nothing is lost.
 */
export function dropBooleanItems(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(dropBooleanItems);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "items" && typeof value === "boolean") continue;
    out[key] = dropBooleanItems(value);
  }
  return out;
}

/**
 * Structured-output format for a zod schema: the same JSON schema the SDK's
 * `zodOutputFormat` would send, made acceptable to its transform, with a
 * parser that validates the answer against the schema. Parse failures are
 * raised as `AiParseError` (the SDK wraps them; `toAiError` unwraps).
 */
export function structuredOutputFormat<S extends z.ZodType>(schema: S, parseMessage?: string): AutoParseableOutputFormat<z.output<S>> {
  const json = dropBooleanItems(z.toJSONSchema(schema, { reused: "ref" })) as JSONSchema;
  return {
    type: "json_schema",
    schema: transformJSONSchema(json),
    parse: (content: string): z.output<S> => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        throw new AiParseError(parseMessage);
      }
      const result = schema.safeParse(parsed);
      if (!result.success) throw new AiParseError(parseMessage);
      return result.data as z.output<S>;
    },
  };
}

/** The SDK client: one per request for a visitor's own key, else created once per process from ANTHROPIC_API_KEY. Never runs in the browser. */
function getClient(auth?: AiAuth): Anthropic {
  if (auth) return new Anthropic({ apiKey: auth.apiKey, timeout: AI_TIMEOUT_MS, maxRetries: AI_MAX_RETRIES });
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new AiError("auth", "ANTHROPIC_API_KEY is not set on the server.");
  client = new Anthropic({ apiKey, timeout: AI_TIMEOUT_MS, maxRetries: AI_MAX_RETRIES });
  return client;
}

const PARSE_PREFIX = "Failed to parse structured output";

/**
 * Map SDK errors (and our own) to `AiError`. Messages are written for the
 * person using the app: SDK internals such as zod issue lists never leave
 * the server.
 */
export function toAiError(err: unknown, parseMessage?: string): AiError {
  if (err instanceof AiError) return err;
  if (err instanceof Anthropic.AuthenticationError) {
    return new AiError("auth", "The Anthropic API key was rejected. Check the key and try again.");
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new AiError("rate_limit", "Claude is rate limited right now. Wait a moment and try again.");
  }
  if (err instanceof Anthropic.APIUserAbortError) {
    return new AiError("network", "The request was cancelled before Claude answered.");
  }
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return new AiError("network", "Claude took too long to answer. Try again, or ask for fewer slides.");
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new AiError("network", "Could not reach the Claude API. Check the server's network connection and try again.");
  }
  if (err instanceof Anthropic.APIError) {
    const status = err.status ? ` (HTTP ${err.status})` : "";
    return new AiError("api", `The Claude API returned an error${status}.`);
  }
  // The SDK's own (non-HTTP) errors: structured-output parsing is the one that matters.
  if (err instanceof Anthropic.AnthropicError) {
    if (err.message.startsWith(PARSE_PREFIX)) return new AiParseError(parseMessage);
    return new AiError("api", "Unexpected error while calling Claude.");
  }
  return new AiError("api", "Unexpected error while calling Claude.");
}

type StructuredCall<S extends z.ZodType> = {
  schema: S;
  system: string;
  /** Plain text, or content blocks when the message carries a picture. */
  user: string | Anthropic.Messages.ContentBlockParam[];
  effort: "low" | "medium";
  refusedMessage?: string;
  parseMessage?: string;
  signal?: AbortSignal;
  auth?: AiAuth;
};

/** One structured-output call: cached system prompt, adaptive thinking, output validated against `schema`. */
async function parseWithClaude<S extends z.ZodType>(call: StructuredCall<S>): Promise<z.output<S>> {
  try {
    const response = await getClient(call.auth).messages.parse(
      {
        model: AI_MODEL,
        max_tokens: MAX_TOKENS,
        thinking: { type: "adaptive" },
        output_config: { format: structuredOutputFormat(call.schema, call.parseMessage), effort: call.effort },
        system: [{ type: "text", text: call.system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: call.user }],
      },
      { signal: call.signal },
    );
    if (response.stop_reason === "refusal") throw new AiRefusedError(call.refusedMessage);
    if (response.stop_reason === "max_tokens" || response.stop_reason === "model_context_window_exceeded") {
      throw new AiParseError("Claude ran out of room before finishing the answer. Ask for fewer slides or a shorter change and try again.");
    }
    if (response.parsed_output == null) throw new AiParseError(call.parseMessage);
    return response.parsed_output;
  } catch (err) {
    throw toAiError(err, call.parseMessage);
  }
}

export function claudeGenerate(req: GenerateRequest, opts: AiCallOptions = {}): Promise<Generation> {
  return parseWithClaude({
    schema: GenerationSchema,
    system: GENERATE_SYSTEM,
    user: buildGenerateUserMessage(req),
    effort: "medium",
    signal: opts.signal,
    auth: opts.auth,
  });
}

export function claudeRevise(req: ReviseRequest, opts: AiCallOptions = {}): Promise<Revision> {
  return parseWithClaude({
    schema: RevisionSchema,
    system: REVISE_SYSTEM,
    user: buildReviseUserMessage(req),
    effort: "medium",
    refusedMessage: "Claude declined to revise the deck with this instruction. Try rephrasing it.",
    parseMessage: "Claude returned a revision that could not be parsed. Please try again.",
    signal: opts.signal,
    auth: opts.auth,
  });
}

export function claudeSuggest(req: SuggestRequest, opts: AiCallOptions = {}): Promise<SuggestResponse> {
  return parseWithClaude({
    schema: SuggestResponseSchema,
    system: SUGGEST_SYSTEM,
    user: buildSuggestUserMessage(req),
    effort: "low",
    refusedMessage: "Claude declined to suggest answers for this question. Type your own answer instead.",
    parseMessage: "Claude returned suggestions that could not be parsed. Please try again.",
    signal: opts.signal,
    auth: opts.auth,
  });
}

/** Smart convert: lay one PDF page out as editable elements from its picture and text lines. */
export function claudeSmartPage(req: SmartPageRequest, opts: AiCallOptions = {}): Promise<SmartPage> {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.*)$/.exec(req.image);
  if (!m) throw new AiError("api", "The page picture could not be read.");
  return parseWithClaude({
    schema: SmartPageSchema,
    system: SMART_PAGE_SYSTEM,
    user: [
      { type: "image", source: { type: "base64", media_type: m[1] as "image/jpeg" | "image/png" | "image/webp", data: m[2] } },
      { type: "text", text: buildSmartPageUserText(req) },
    ],
    effort: "low",
    refusedMessage: "Claude declined to convert this page.",
    parseMessage: "Claude returned a page layout that could not be read.",
    signal: opts.signal,
    auth: opts.auth,
  });
}

export function claudeOutline(req: OutlineRequest, opts: AiCallOptions = {}): Promise<Outline> {
  return parseWithClaude({
    schema: OutlineSchema,
    system: OUTLINE_SYSTEM,
    user: buildOutlineUserMessage(req),
    effort: "medium",
    refusedMessage: "Claude declined to outline this brief. Try rephrasing it.",
    parseMessage: "Claude returned an outline that could not be parsed. Please try again.",
    signal: opts.signal,
    auth: opts.auth,
  });
}
