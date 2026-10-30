import type { AiSource } from "@/lib/api-client";

/**
 * Who pays for an AI call. A visitor can bring their own key (sent per request in headers, never stored
 * or logged); the server's own env key is used only where it is allowed (see `serverKeyAllowed`).
 */

export type AiProvider = "openai" | "anthropic";
/**
 * "openrouter" is internal: it marks a key taken from the server's pool (Presenta Studio), never one a visitor
 * sends. `model` is the pooled model chosen by the admin.
 */
export type AiAuth = { provider: AiProvider | "openrouter"; apiKey: string; model?: string };

/** Request headers the browser uses to carry the visitor's own key. */
export const KEY_HEADER = "x-ai-key";
export const PROVIDER_HEADER = "x-ai-provider";

/** Which provider and key will serve a request, and the label the UI shows for it. */
export type AiResolution = {
  source: AiSource;
  auth?: AiAuth;
  /** Set when the request is served by the pooled keys ("Presenta Studio"); see `resolveAiForRequest`. */
  presenta?: { userId: string; cost: number; model: string };
};

const KEY_PATTERN = /^[A-Za-z0-9._-]{20,400}$/;

export function isAiProvider(value: unknown): value is AiProvider {
  return value === "openai" || value === "anthropic";
}

export function isPlausibleKey(key: string): boolean {
  return KEY_PATTERN.test(key);
}

/** The visitor's key from the request headers, or undefined when absent or malformed. */
export function readAiAuth(headers: Headers): AiAuth | undefined {
  const provider = headers.get(PROVIDER_HEADER)?.trim().toLowerCase();
  const apiKey = headers.get(KEY_HEADER)?.trim();
  if (!apiKey || !isAiProvider(provider) || !isPlausibleKey(apiKey)) return undefined;
  return { provider, apiKey };
}

/**
 * Whether the server's own ANTHROPIC_API_KEY / OPENAI_API_KEY may serve requests that bring no key.
 * AI_ALLOW_SERVER_KEY=true|false decides; unset means allowed in development and refused in production,
 * so a public deployment never spends the owner's key by accident.
 */
export function serverKeyAllowed(): boolean {
  const flag = process.env.AI_ALLOW_SERVER_KEY?.trim().toLowerCase();
  if (flag === "true") return true;
  if (flag === "false") return false;
  return process.env.NODE_ENV !== "production";
}

const hasKey = (name: string) => Boolean(process.env[name]?.trim());

/** Provider chosen from the server's env keys alone (ignores `serverKeyAllowed`). */
export function envSource(): AiSource {
  const forced = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (forced === "openai") return hasKey("OPENAI_API_KEY") ? "openai" : "mock";
  if (forced === "anthropic") return hasKey("ANTHROPIC_API_KEY") ? "claude" : "mock";
  if (hasKey("ANTHROPIC_API_KEY")) return "claude";
  return hasKey("OPENAI_API_KEY") ? "openai" : "mock";
}

/** Resolve a request: the visitor's key first, then the server key where allowed, otherwise the offline mock. */
export function resolveAi(request: Request): AiResolution {
  const auth = readAiAuth(request.headers);
  if (auth) return { source: auth.provider === "openai" ? "openai" : "claude", auth };
  // (The pooled "Presenta Studio" source needs the session and database, so it is added by `resolveAiForRequest`.)
  return { source: serverKeyAllowed() ? envSource() : "mock" };
}
