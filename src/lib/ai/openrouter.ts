/** Talks to OpenRouter about a key itself (not about decks). Server only; keys are never logged or returned to the browser. */

export type KeyInfo = {
  ok: boolean;
  /** The key is real but has no credit or hit its limit. */
  exhausted: boolean;
  /** Credits spent so far, in USD. */
  usage: number | null;
  /** Spending cap in USD, or null when the key has none. */
  limit: number | null;
  remaining: number | null;
  freeTier: boolean;
  error?: string;
};

const KEY_URL = "https://openrouter.ai/api/v1/key";

/** Looks a key up on OpenRouter. Used when an admin adds a key and when they press "Check". */
export async function fetchKeyInfo(apiKey: string): Promise<KeyInfo> {
  const empty = { exhausted: false, usage: null, limit: null, remaining: null, freeTier: false };
  try {
    const res = await fetch(KEY_URL, { headers: { authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(10_000), cache: "no-store" });
    if (res.status === 401 || res.status === 403) return { ...empty, ok: false, error: "OpenRouter rejected this key." };
    if (!res.ok) return { ...empty, ok: false, error: `OpenRouter answered HTTP ${res.status}.` };
    const body = (await res.json()) as { data?: { usage?: number; limit?: number | null; limit_remaining?: number | null; is_free_tier?: boolean } };
    const d = body.data ?? {};
    const remaining = typeof d.limit_remaining === "number" ? d.limit_remaining : null;
    return {
      ok: true,
      exhausted: remaining !== null && remaining <= 0,
      usage: typeof d.usage === "number" ? d.usage : null,
      limit: typeof d.limit === "number" ? d.limit : null,
      remaining,
      freeTier: Boolean(d.is_free_tier),
    };
  } catch {
    return { ...empty, ok: false, error: "Could not reach OpenRouter." };
  }
}
