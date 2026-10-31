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
import { AI_TIMEOUT_MS, dropBooleanItems, type AiCallOptions } from "./claude";
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

const MAX_TOKENS = 16000;
const DEFAULT_MODEL = "gpt-4o";
const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
/** Gemini model for visitors who bring a Gemini key; override with GEMINI_MODEL. */
export const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash";
/** Tried in turn when a Gemini model is overloaded (503) or the key has no quota left for it (429). */
const GEMINI_FALLBACKS = ["gemini-flash-latest", "gemini-3.8-flash", "gemini-3.1-flash-lite"];
/** Gemini can think for a long time before answering; it gets one long attempt instead of the usual budget. */
const GEMINI_TIMEOUT_MS = 110_000;
/** What customers see instead of the provider's name when a request is served from the pooled keys. */
const POOL_BRAND = "Presenta Studio";

/** Where one request goes, and how its errors are worded. */
type Target = { baseUrl: string; model: string; brand: string; pooled: boolean; timeoutMs: number };

const brandOf = (auth?: AiAuth) => (auth?.provider === "openrouter" ? POOL_BRAND : auth?.provider === "gemini" ? "Gemini" : "OpenAI");

/** Model name sent to the Chat Completions endpoint; override with OPENAI_MODEL. */
export function openAiModel(): string {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
}

export function hasOpenAiKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

type MessageContent = ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "auto" } })[];

type ChatResponse = {
  choices?: { finish_reason?: string; message?: { content?: string | null; refusal?: string | null } }[];
};

function statusToError(status: number, brand: string): AiError {
  if (status === 401 || status === 403) return new AiError("auth", `The ${brand} API key was rejected. Check the key and try again.`, status);
  if (status === 429) return new AiError("rate_limit", `${brand} is rate limited right now. Wait a moment and try again.`, status);
  if (status === 503) return new AiError("api", `${brand} is busy right now. Try again in a moment.`, status);
  return new AiError("api", `The ${brand} API returned an error (HTTP ${status}).`, status);
}

/** One structured-output call to the Chat Completions API; the answer is validated against `schema`. */
async function parseWithOpenAi<S extends z.ZodType>(call: {
  schema: S;
  name: string;
  system: string;
  /** Plain text, or content parts when the message carries a picture. */
  user: string | MessageContent;
  refusedMessage?: string;
  parseMessage?: string;
  signal?: AbortSignal;
  /** The visitor's own key; when absent the server's OPENAI_API_KEY is used. */
  auth?: AiAuth;
}): Promise<z.output<S>> {
  const apiKey = call.auth?.apiKey ?? process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new AiError("auth", "No OpenAI API key is available. Add your key in Settings.");
  const pooled = call.auth?.provider === "openrouter";
  const gemini = call.auth?.provider === "gemini";
  // A visitor's key only ever goes to OpenAI itself; the configurable base URL belongs to the server's own key.
  // Pooled keys go to OpenRouter, with the model the admin chose.
  const target: Target = {
    baseUrl: (pooled ? OPENROUTER_BASE_URL : gemini ? GEMINI_BASE_URL : call.auth ? DEFAULT_BASE_URL : process.env.OPENAI_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, ""),
    model: pooled ? (call.auth?.model ?? "openai/gpt-4o-mini") : gemini ? GEMINI_MODEL : openAiModel(),
    brand: brandOf(call.auth),
    pooled,
    timeoutMs: gemini ? GEMINI_TIMEOUT_MS : AI_TIMEOUT_MS,
  };

  const messages: { role: "system" | "user" | "assistant"; content: string | MessageContent }[] = [
    { role: "system", content: call.system },
    { role: "user", content: call.user },
  ];

  // Non-strict schema mode lets the model slip past a constraint now and then, so a failed
  // validation gets one retry with the issues fed back.
  const models = gemini ? [target.model, ...GEMINI_FALLBACKS.filter((m) => m !== target.model)] : [target.model];
  for (let attempt = 0; ; attempt++) {
    const outcome = await requestWithFallback(call, apiKey, target, messages, models);
    if (outcome.ok) return outcome.data;
    if (attempt >= 1) throw new AiParseError(call.parseMessage);
    messages.push(
      { role: "assistant", content: outcome.content },
      { role: "user", content: `That JSON failed validation: ${outcome.issues}. Return the complete corrected JSON, nothing else.` },
    );
  }
}

/** One request; with Gemini, a busy or out-of-quota model hands over to the next one in `models`. */
async function requestWithFallback<S extends z.ZodType>(
  call: Parameters<typeof requestOnce<S>>[0],
  apiKey: string,
  target: Target,
  messages: { role: string; content: string | MessageContent }[],
  models: string[],
): Promise<Outcome<z.output<S>>> {
  for (let i = 0; ; i += 1) {
    try {
      return await requestOnce(call, apiKey, { ...target, model: models[i] }, messages);
    } catch (err) {
      const busy = err instanceof AiError && (err.status === 503 || err.status === 429);
      if (!busy || i >= models.length - 1) throw err;
    }
  }
}

/** Range and length limits Gemini refuses in a response schema ("invalid argument"); the answer is still checked against them. */
const GEMINI_UNSUPPORTED = new Set(["$schema", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "minLength", "maxLength", "minItems", "maxItems", "pattern", "format"]);

function withoutKeys(node: unknown, keys: Set<string>): unknown {
  if (Array.isArray(node)) return node.map((n) => withoutKeys(n, keys));
  if (!node || typeof node !== "object") return node;
  // A property may be named like a keyword ("format"), so only keyword positions are dropped: not keys of "properties".
  return Object.fromEntries(
    Object.entries(node as Record<string, unknown>)
      .filter(([k, v]) => !keys.has(k) || typeof v === "object")
      .map(([k, v]) => [k, k === "properties" && v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([pk, pv]) => [pk, withoutKeys(pv, keys)])) : withoutKeys(v, keys)]),
  );
}

function schemaFor(schema: z.ZodType, target: Target): unknown {
  const json = dropBooleanItems(z.toJSONSchema(schema, { reused: "ref" }));
  return target.brand === "Gemini" ? withoutKeys(json, GEMINI_UNSUPPORTED) : json;
}

type Outcome<T> = { ok: true; data: T } | { ok: false; content: string; issues: string };

async function requestOnce<S extends z.ZodType>(
  call: { schema: S; name: string; refusedMessage?: string; parseMessage?: string; signal?: AbortSignal },
  apiKey: string,
  target: Target,
  messages: { role: string; content: string | MessageContent }[],
): Promise<Outcome<z.output<S>>> {
  const deadline = AbortSignal.timeout(target.timeoutMs);
  const signal = call.signal ? AbortSignal.any([call.signal, deadline]) : deadline;

  let res: Response;
  try {
    res = await fetch(`${target.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
        ...(target.pooled ? { "x-title": POOL_BRAND } : {}),
      },
      body: JSON.stringify({
        model: target.model,
        ...(target.pooled || target.brand === "Gemini" ? { max_tokens: MAX_TOKENS } : { max_completion_tokens: MAX_TOKENS }),
        messages,
        // Non-strict: zod emits optional fields that strict mode rejects, and the answer is re-validated below.
        response_format: {
          type: "json_schema",
          json_schema: { name: call.name, strict: false, schema: schemaFor(call.schema, target) },
        },
      }),
      signal,
    });
  } catch (err) {
    if (call.signal?.aborted) throw new AiError("network", `The request was cancelled before ${target.brand} answered.`);
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new AiError("network", `${target.brand} took too long to answer. Try again, or ask for fewer slides.`);
    }
    throw new AiError("network", `Could not reach ${target.brand}. Check the connection and try again.`);
  }

  if (!res.ok) {
    // eslint-disable-next-line no-console -- server-side diagnostics; the client only sees the short message
    if (res.status === 400) console.warn(`[${target.brand}] ${call.name} rejected (HTTP 400):`, (await res.text().catch(() => "")).slice(0, 600));
    throw statusToError(res.status, target.brand);
  }

  const body = (await res.json().catch(() => null)) as ChatResponse | null;
  const choice = body?.choices?.[0];
  if (choice?.message?.refusal) throw new AiRefusedError(call.refusedMessage);
  if (choice?.finish_reason === "length") {
    throw new AiParseError(`${target.brand} ran out of room before finishing the answer. Ask for fewer slides or a shorter change and try again.`);
  }
  const content = choice?.message?.content;
  if (!content) throw new AiParseError(call.parseMessage);

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { ok: false, content, issues: "it was not valid JSON" };
  }
  const result = call.schema.safeParse(parsed);
  if (!result.success) {
    const issues = JSON.stringify(result.error.issues.slice(0, 8).map((i) => ({ path: i.path.join("."), message: i.message })));
    // eslint-disable-next-line no-console -- server-side diagnostics; the client only sees the generic parse message
    console.warn(`[openai] ${call.name} failed validation:`, issues);
    return { ok: false, content, issues };
  }
  return { ok: true, data: result.data as z.output<S> };
}

export function openAiGenerate(req: GenerateRequest, opts: AiCallOptions = {}): Promise<Generation> {
  return parseWithOpenAi({ schema: GenerationSchema, name: "generation", system: GENERATE_SYSTEM, user: buildGenerateUserMessage(req), signal: opts.signal, auth: opts.auth });
}

export function openAiRevise(req: ReviseRequest, opts: AiCallOptions = {}): Promise<Revision> {
  return parseWithOpenAi({
    schema: RevisionSchema,
    name: "revision",
    system: REVISE_SYSTEM,
    user: buildReviseUserMessage(req),
    refusedMessage: `${brandOf(opts.auth)} declined to revise the deck with this instruction. Try rephrasing it.`,
    parseMessage: `${brandOf(opts.auth)} returned a revision that could not be parsed. Please try again.`,
    signal: opts.signal,
    auth: opts.auth,
  });
}

export function openAiSuggest(req: SuggestRequest, opts: AiCallOptions = {}): Promise<SuggestResponse> {
  return parseWithOpenAi({
    schema: SuggestResponseSchema,
    name: "suggestions",
    system: SUGGEST_SYSTEM,
    user: buildSuggestUserMessage(req),
    refusedMessage: `${brandOf(opts.auth)} declined to suggest answers for this question. Type your own answer instead.`,
    parseMessage: `${brandOf(opts.auth)} returned suggestions that could not be parsed. Please try again.`,
    signal: opts.signal,
    auth: opts.auth,
  });
}

/** Smart convert: lay one PDF page out as editable elements from its picture and text lines. */
export function openAiSmartPage(req: SmartPageRequest, opts: AiCallOptions = {}): Promise<SmartPage> {
  return parseWithOpenAi({
    schema: SmartPageSchema,
    name: "page_layout",
    system: SMART_PAGE_SYSTEM,
    user: [
      { type: "text", text: buildSmartPageUserText(req) },
      { type: "image_url", image_url: { url: req.image, detail: "high" } },
    ],
    refusedMessage: `${brandOf(opts.auth)} declined to convert this page.`,
    parseMessage: `${brandOf(opts.auth)} returned a page layout that could not be read.`,
    signal: opts.signal,
    auth: opts.auth,
  });
}

export function openAiOutline(req: OutlineRequest, opts: AiCallOptions = {}): Promise<Outline> {
  return parseWithOpenAi({
    schema: OutlineSchema,
    name: "outline",
    system: OUTLINE_SYSTEM,
    user: buildOutlineUserMessage(req),
    refusedMessage: `${brandOf(opts.auth)} declined to outline this brief. Try rephrasing it.`,
    parseMessage: `${brandOf(opts.auth)} returned an outline that could not be parsed. Please try again.`,
    signal: opts.signal,
    auth: opts.auth,
  });
}


