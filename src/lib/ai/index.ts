import type { AiSource } from "@/lib/api-client";
import type { GenerateRequest, Generation, Outline, OutlineRequest, ReviseRequest, Revision, SuggestRequest, SuggestResponse } from "@/lib/deck/schema";
import { AI_MODEL as CLAUDE_MODEL, claudeGenerate, claudeOutline, claudeRevise, claudeSuggest, type AiCallOptions } from "./claude";
import { mockGenerate, mockOutline, mockRevise, mockSuggest } from "./mock";
import { hasOpenAiKey, openAiGenerate, openAiModel, openAiOutline, openAiRevise, openAiSuggest } from "./openai";

export type { AiCallOptions };
export { AiError } from "./errors";

/**
 * Server-side entry point of the AI layer. The provider is chosen from the
 * environment: AI_PROVIDER ("anthropic" | "openai") forces one, otherwise
 * ANTHROPIC_API_KEY wins over OPENAI_API_KEY. With neither key set the
 * deterministic offline mock answers. `opts.signal` cancels the upstream
 * call; the mock answers synchronously and ignores it.
 */

export function hasAnthropicKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export function aiSource(): AiSource {
  const forced = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (forced === "openai") return hasOpenAiKey() ? "openai" : "mock";
  if (forced === "anthropic") return hasAnthropicKey() ? "claude" : "mock";
  if (hasAnthropicKey()) return "claude";
  return hasOpenAiKey() ? "openai" : "mock";
}

export function hasAiKey(): boolean {
  return aiSource() !== "mock";
}

/** Model name of the active provider (Claude's when running on the mock). */
export function activeModel(): string {
  return aiSource() === "openai" ? openAiModel() : CLAUDE_MODEL;
}

export async function generateDeck(req: GenerateRequest, opts: AiCallOptions = {}): Promise<Generation> {
  const source = aiSource();
  return source === "claude" ? claudeGenerate(req, opts) : source === "openai" ? openAiGenerate(req, opts) : mockGenerate(req);
}

export async function reviseDeck(req: ReviseRequest, opts: AiCallOptions = {}): Promise<Revision> {
  const source = aiSource();
  return source === "claude" ? claudeRevise(req, opts) : source === "openai" ? openAiRevise(req, opts) : mockRevise(req);
}

/** Answer options for the current intake question. */
export async function suggestAnswers(req: SuggestRequest, opts: AiCallOptions = {}): Promise<SuggestResponse> {
  const source = aiSource();
  return source === "claude" ? claudeSuggest(req, opts) : source === "openai" ? openAiSuggest(req, opts) : mockSuggest(req);
}

/** Slide-by-slide outline from the brief or pasted material, for review before generation. */
export async function buildOutline(req: OutlineRequest, opts: AiCallOptions = {}): Promise<Outline> {
  const source = aiSource();
  return source === "claude" ? claudeOutline(req, opts) : source === "openai" ? openAiOutline(req, opts) : mockOutline(req);
}
