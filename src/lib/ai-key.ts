import type { AiProvider } from "@/lib/ai/auth";
import { KEY_HEADER, PROVIDER_HEADER, isAiProvider, isPlausibleKey } from "@/lib/ai/auth";

/**
 * The visitor's own AI key, kept in this browser only. "Remember" stores it in localStorage; otherwise it
 * lives in sessionStorage and goes away with the tab. It is sent as headers with each AI request and never
 * written to a deck, a URL or the server.
 */

const STORAGE_KEY = "presenta:ai-key";
export const KEY_CHANGED_EVENT = "presenta:ai-key-changed";

export type StoredKey = { provider: AiProvider; apiKey: string; remember: boolean };

function parse(raw: string | null, remember: boolean): StoredKey | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { provider?: unknown; apiKey?: unknown };
    if (isAiProvider(v.provider) && typeof v.apiKey === "string" && isPlausibleKey(v.apiKey)) return { provider: v.provider, apiKey: v.apiKey, remember };
  } catch {
    /* fall through */
  }
  return null;
}

export function getStoredKey(): StoredKey | null {
  if (typeof window === "undefined") return null;
  try {
    return parse(window.sessionStorage.getItem(STORAGE_KEY), false) ?? parse(window.localStorage.getItem(STORAGE_KEY), true);
  } catch {
    return null;
  }
}

function announce(): void {
  window.dispatchEvent(new Event(KEY_CHANGED_EVENT));
}

/** Throws when the key looks malformed or the browser refuses to store it. */
export function setStoredKey(key: StoredKey): void {
  const apiKey = key.apiKey.trim();
  if (!isPlausibleKey(apiKey)) throw new Error("That does not look like a valid API key.");
  clearStoredKey(false);
  const store = key.remember ? window.localStorage : window.sessionStorage;
  store.setItem(STORAGE_KEY, JSON.stringify({ provider: key.provider, apiKey }));
  announce();
}

export function clearStoredKey(notify = true): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  if (notify) announce();
}

/** Headers that carry the stored key on an AI request; empty when there is none. */
export function aiKeyHeaders(): Record<string, string> {
  const k = getStoredKey();
  return k ? { [KEY_HEADER]: k.apiKey, [PROVIDER_HEADER]: k.provider } : {};
}

export function maskKey(key: string): string {
  return key.length <= 10 ? "••••" : `${key.slice(0, 5)}…${key.slice(-4)}`;
}
