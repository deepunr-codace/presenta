import type { AiSource } from "@/lib/api-client";
import type { GenerateRequest, Generation, Outline, OutlineRequest, ReviseRequest, Revision, SuggestRequest, SuggestResponse } from "@/lib/deck/schema";
import { envSource, serverKeyAllowed, type AiResolution } from "./auth";
import type { SmartPage, SmartPageRequest } from "@/lib/import/smart-schema";
import { AI_MODEL as CLAUDE_MODEL, claudeGenerate, claudeOutline, claudeRevise, claudeSmartPage, claudeSuggest, type AiCallOptions } from "./claude";
import { AiError } from "./errors";
import { mockGenerate, mockOutline, mockRevise, mockSuggest } from "./mock";
import { GEMINI_MODEL, openAiGenerate, openAiModel, openAiOutline, openAiRevise, openAiSmartPage, openAiSuggest } from "./openai";
import { withPoolKey } from "./presenta";

export type { AiCallOptions };
export { AiError } from "./errors";
export { resolveAi, serverKeyAllowed, type AiResolution } from "./auth";
export { presentaQuota, resolveAiForRequest } from "./presenta";

/**
 * Server-side entry point of the AI layer. Each request is served by the visitor's own key when it
 * brings one (`opts.ai`, from `resolveAi`), else by the server's env key where `serverKeyAllowed`,
 * else by the deterministic offline mock. `opts.signal` cancels the upstream call; the mock answers
 * synchronously and ignores it.
 */

/** Source label for requests that carry no key of their own. */
export function aiSource(): AiSource {
  return serverKeyAllowed() ? envSource() : "mock";
}

export function hasAiKey(): boolean {
  return aiSource() !== "mock";
}

/** Model name for a source (Claude's when running on the mock). Presenta Studio never reveals its model. */
export function activeModel(source: AiSource = aiSource()): string {
  if (source === "presenta") return "Presenta Studio";
  if (source === "gemini") return GEMINI_MODEL;
  return source === "openai" ? openAiModel() : CLAUDE_MODEL;
}

export type AiRunOptions = Omit<AiCallOptions, "auth"> & { ai?: AiResolution };

function pick<T>(opts: AiRunOptions, run: { claude: (o: AiCallOptions) => Promise<T>; openai: (o: AiCallOptions) => Promise<T>; mock: () => T }): Promise<T> {
  const ai = opts.ai ?? { source: aiSource() };
  const call: AiCallOptions = { signal: opts.signal, auth: ai.auth };
  // Presenta Studio: the same chat-completions path as OpenAI, with a key from the pool.
  if (ai.source === "presenta" && ai.presenta) return withPoolKey(ai.presenta, (auth) => run.openai({ ...call, auth }));
  if (ai.source === "claude") return run.claude(call);
  // Gemini speaks the same Chat Completions API through Google's OpenAI-compatible endpoint.
  if (ai.source === "openai" || ai.source === "gemini") return run.openai(call);
  return Promise.resolve(run.mock());
}

export function generateDeck(req: GenerateRequest, opts: AiRunOptions = {}): Promise<Generation> {
  return pick(opts, { claude: (o) => claudeGenerate(req, o), openai: (o) => openAiGenerate(req, o), mock: () => mockGenerate(req) });
}

export function reviseDeck(req: ReviseRequest, opts: AiRunOptions = {}): Promise<Revision> {
  return pick(opts, { claude: (o) => claudeRevise(req, o), openai: (o) => openAiRevise(req, o), mock: () => mockRevise(req) });
}

/** Answer options for the current intake question. */
export function suggestAnswers(req: SuggestRequest, opts: AiRunOptions = {}): Promise<SuggestResponse> {
  return pick(opts, { claude: (o) => claudeSuggest(req, o), openai: (o) => openAiSuggest(req, o), mock: () => mockSuggest(req) });
}

/** Smart convert of one PDF page. There is no offline version: without AI the import uses the standard converter. */
export function smartPageLayout(req: SmartPageRequest, opts: AiRunOptions = {}): Promise<SmartPage> {
  return pick(opts, {
    claude: (o) => claudeSmartPage(req, o),
    openai: (o) => openAiSmartPage(req, o),
    mock: () => {
      throw new AiError("auth", "Smart convert needs AI. Add your API key in Settings, or ask an admin to turn on Presenta Studio.");
    },
  });
}

/** Slide-by-slide outline from the brief or pasted material, for review before generation. */
export function buildOutline(req: OutlineRequest, opts: AiRunOptions = {}): Promise<Outline> {
  return pick(opts, { claude: (o) => claudeOutline(req, o), openai: (o) => openAiOutline(req, o), mock: () => mockOutline(req) });
}
