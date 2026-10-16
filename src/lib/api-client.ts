import { compactDeckForRevise } from "@/lib/ai/compact";
import type { AiErrorCode } from "@/lib/ai/errors";
import type {
  GenerateRequest,
  Generation,
  Outline,
  OutlineRequest,
  ReviseRequest,
  Revision,
  SuggestRequest,
  SuggestResponse,
} from "@/lib/deck/schema";

/**
 * Typed client for the app's JSON API routes. Every route answers with the
 * same envelope, so callers narrow on `ok` and never see a thrown error.
 */

export type AiSource = "claude" | "openai" | "mock";

export type ApiErrorCode = AiErrorCode | "too_large" | "cancelled";

export type ApiOk<T> = { ok: true; data: T; source: AiSource };
export type ApiFail = { ok: false; error: string; code: ApiErrorCode };
export type ApiResult<T> = ApiOk<T> | ApiFail;

export type AiHealth = { hasKey: boolean; model: string; provider: AiSource };

/** Hard deadline for one API call from the browser; the server gives the AI 55 s per attempt. */
const REQUEST_TIMEOUT_MS = 90_000;

/** Request bodies may omit fields the schema defaults (slideCount, tone, ...); the route applies the defaults. */
type Body<T> = Partial<T> & Pick<T, Extract<keyof T, "mode" | "input" | "deck" | "instruction" | "stage" | "question">>;

export type GenerateBody = Body<GenerateRequest>;
export type ReviseBody = Body<ReviseRequest>;
export type SuggestBody = Body<SuggestRequest>;
export type OutlineBody = Body<OutlineRequest>;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isApiResult<T>(v: unknown): v is ApiResult<T> {
  if (!isRecord(v) || typeof v.ok !== "boolean") return false;
  if (v.ok) return "data" in v && (v.source === "claude" || v.source === "openai" || v.source === "mock");
  return typeof v.error === "string" && typeof v.code === "string";
}

async function request<T>(url: string, init: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, init);
    const json: unknown = await res.json().catch(() => null);
    if (isApiResult<T>(json)) return json;
    return { ok: false, error: `Unexpected response from the server (HTTP ${res.status}).`, code: "api" };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: false, error: "The request was cancelled.", code: "cancelled" };
    }
    if (err instanceof DOMException && err.name === "TimeoutError") {
      return { ok: false, error: `The server did not answer within ${REQUEST_TIMEOUT_MS / 1000} seconds. Try again.`, code: "network" };
    }
    return { ok: false, error: err instanceof Error ? err.message : "Could not reach the server.", code: "network" };
  }
}

/**
 * The caller's signal combined with a deadline, where the runtime supports
 * `AbortSignal.timeout` / `AbortSignal.any`; otherwise the caller's signal alone.
 */
export function withDeadline(signal?: AbortSignal, timeoutMs = REQUEST_TIMEOUT_MS): AbortSignal | undefined {
  if (typeof AbortSignal === "undefined" || typeof AbortSignal.timeout !== "function") return signal;
  const deadline = AbortSignal.timeout(timeoutMs);
  if (!signal) return deadline;
  return typeof AbortSignal.any === "function" ? AbortSignal.any([signal, deadline]) : signal;
}

function post<T>(url: string, body: unknown, signal?: AbortSignal): Promise<ApiResult<T>> {
  return request<T>(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: withDeadline(signal),
  });
}

export function postGenerate(req: GenerateBody, signal?: AbortSignal): Promise<ApiResult<Generation>> {
  return post<Generation>("/api/generate", req, signal);
}

/** Embedded images are stripped from the deck before it is sent; the model only needs the text and ids. */
export function postRevise(req: ReviseBody, signal?: AbortSignal): Promise<ApiResult<Revision>> {
  return post<Revision>("/api/revise", { ...req, deck: compactDeckForRevise(req.deck) }, signal);
}

export function postSuggest(req: SuggestBody, signal?: AbortSignal): Promise<ApiResult<SuggestResponse>> {
  return post<SuggestResponse>("/api/suggest", req, signal);
}

export function postOutline(req: OutlineBody, signal?: AbortSignal): Promise<ApiResult<Outline>> {
  return post<Outline>("/api/outline", req, signal);
}

export function getHealth(signal?: AbortSignal): Promise<ApiResult<AiHealth>> {
  return request<AiHealth>("/api/health", { method: "GET", signal });
}

export function sourceLabel(source: AiSource | null | undefined): string {
  if (source === "claude") return "Claude";
  if (source === "openai") return "OpenAI";
  if (source === "mock") return "Offline mock";
  return "Checking…";
}
