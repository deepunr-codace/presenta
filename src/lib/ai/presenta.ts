import type { AiAuth, AiResolution } from "./auth";
import { resolveAi } from "./auth";
import { AiError } from "./errors";
import { getPresentaSettings, listPoolKeys, recordPoolKeyError, releaseAllowance, reserveAllowance, takePoolKey, usedToday, type KeyPenalty } from "./pool-db";

/**
 * "Presenta Studio": AI the app provides to signed-in customers from a pool of OpenRouter keys that an admin manages.
 * Customers never see the provider, the model or a key. Each signed-in user gets a daily allowance; a visitor's own
 * key (Settings) always takes priority and is not limited. Server only.
 */

/** Tries per request: a bad or exhausted key is set aside and the next one is used straight away. */
const MAX_KEY_ATTEMPTS = 5;

const REASON: Record<number, string> = { 401: "key rejected", 402: "out of credit", 403: "key rejected", 429: "rate limited" };

async function currentUserId(): Promise<string | null> {
  try {
    const { auth } = await import("@/auth");
    return (await auth())?.user?.id ?? null;
  } catch {
    return null;
  }
}

/** At least one key is switched on and not resting. */
async function poolHasKeys(): Promise<boolean> {
  return (await listPoolKeys()).some((k) => k.enabled && !k.cooldownUntil);
}

/**
 * Resolve who serves a request. A visitor's own key wins; otherwise a signed-in user is served by Presenta Studio
 * when an admin has it on and at least one pooled key is enabled; otherwise the existing server-key / offline rules apply.
 * `cost` is how many requests of the daily allowance this call uses (0 to only check availability).
 * Throws a `rate_limit` AiError when the allowance is spent.
 */
export async function resolveAiForRequest(request: Request, opts: { cost?: number } = {}): Promise<AiResolution> {
  const base = resolveAi(request);
  if (base.auth) return base;

  const cost = opts.cost ?? 1;
  try {
    const userId = await currentUserId();
    if (!userId) return base;
    const [settings, hasKeys] = await Promise.all([getPresentaSettings(), poolHasKeys()]);
    if (!settings.enabled || !hasKeys) return base;

    if (cost > 0) {
      const taken = await reserveAllowance(userId, settings.dailyLimit);
      if (!taken.ok) {
        throw new AiError(
          "rate_limit",
          `You've used today's ${settings.dailyLimit} free Presenta Studio requests. They reset tomorrow, or add your own API key in Settings to keep going.`,
        );
      }
    }
    return { source: "presenta", presenta: { userId, cost, model: settings.model } };
  } catch (err) {
    if (err instanceof AiError) throw err;
    // The pool is unavailable (for example the database is down): fall back instead of failing the request.
    // eslint-disable-next-line no-console -- server-side diagnostics; the customer just gets the fallback
    console.error("Presenta Studio is unavailable", err);
    return base;
  }
}

/** Today's allowance for the health check; null when Presenta Studio is not what would serve this user. */
export async function presentaQuota(userId: string): Promise<{ used: number; limit: number } | null> {
  const settings = await getPresentaSettings();
  return { used: await usedToday(userId), limit: settings.dailyLimit };
}

/**
 * Whether an upstream failure is the key's fault rather than the request's, and what to do about the key:
 * a rejected key is switched off; a key that is out of credit rests 10 minutes (it comes back by itself once topped up);
 * a throttled key rests a minute. Resting keys are skipped, so the next request does not wait on a call that will fail.
 */
function keyFault(err: unknown): KeyPenalty | null {
  if (!(err instanceof AiError)) return null;
  if (err.status === 401 || err.status === 403) return { kind: "disable" };
  if (err.status === 402) return { kind: "rest", seconds: 600 };
  if (err.status === 429) return { kind: "rest", seconds: 60 };
  return null;
}

/**
 * Run `call` with a pooled key. A key that is rejected or out of credit is switched off (an admin sees why) and the
 * next key is tried. If the call fails for any other reason, or no key works, the user's allowance is given back.
 */
export async function withPoolKey<T>(grant: { userId: string; cost: number; model: string }, call: (auth: AiAuth) => Promise<T>): Promise<T> {
  const tried: string[] = [];
  let lastError: unknown;
  try {
    for (let attempt = 0; attempt < MAX_KEY_ATTEMPTS; attempt += 1) {
      const key = await takePoolKey(tried);
      if (!key) break;
      tried.push(key.id);
      try {
        return await call({ provider: "openrouter", apiKey: key.apiKey, model: grant.model });
      } catch (err) {
        const fault = keyFault(err);
        if (!fault) throw err;
        lastError = err;
        // Do not wait for the bookkeeping: the next key is tried straight away.
        void recordPoolKeyError(key.id, `HTTP ${(err as AiError).status}: ${REASON[(err as AiError).status ?? 0] ?? "key problem"}`, fault).catch(() => undefined);
      }
    }
    // eslint-disable-next-line no-console -- server-side diagnostics; the customer sees only "busy"
    if (lastError) console.error("Every pooled AI key failed", lastError);
    throw new AiError("api", "Presenta Studio is busy right now. Please try again in a moment.");
  } catch (err) {
    if (grant.cost > 0) await releaseAllowance(grant.userId).catch(() => undefined);
    throw err;
  }
}
