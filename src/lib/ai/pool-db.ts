import { createHash } from "node:crypto";
import { ensureUsersTable, sql } from "@/lib/auth/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { newId } from "@/lib/deck/ids";

/**
 * The pool of OpenRouter keys that serve "Presenta Studio", plus the per-user daily allowance and the admin's
 * settings. Keys are encrypted at rest and never leave the server. Server only.
 */

export type PoolKey = {
  id: string;
  label: string;
  hint: string;
  enabled: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  requestCount: number;
  errorCount: number;
  lastError: string | null;
  lastErrorAt: string | null;
  disabledReason: string | null;
  /** Set while a key is resting after hitting a limit; it is skipped until then. */
  cooldownUntil: string | null;
};

type KeyRow = {
  id: string;
  label: string;
  key_hint: string;
  enabled: boolean;
  created_at: string;
  last_used_at: string | null;
  request_count: number;
  error_count: number;
  last_error: string | null;
  last_error_at: string | null;
  disabled_reason: string | null;
  cooldown_until: string | null;
};

const iso = (v: string | null) => (v ? new Date(v).toISOString() : null);

function toKey(r: KeyRow): PoolKey {
  return {
    id: r.id,
    label: r.label,
    hint: r.key_hint,
    enabled: r.enabled,
    createdAt: new Date(r.created_at).toISOString(),
    lastUsedAt: iso(r.last_used_at),
    requestCount: r.request_count,
    errorCount: r.error_count,
    lastError: r.last_error,
    lastErrorAt: iso(r.last_error_at),
    disabledReason: r.disabled_reason,
    cooldownUntil: r.cooldown_until && new Date(r.cooldown_until) > new Date() ? iso(r.cooldown_until) : null,
  };
}

let ensured: Promise<void> | null = null;

export function ensureAiTables(): Promise<void> {
  if (!ensured) {
    ensured = ensureUsersTable()
      .then(
        () => sql()`
          CREATE TABLE IF NOT EXISTS ai_keys (
            id TEXT PRIMARY KEY,
            label TEXT NOT NULL,
            key_enc TEXT NOT NULL,
            key_hint TEXT NOT NULL,
            enabled BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            last_used_at TIMESTAMPTZ,
            request_count INTEGER NOT NULL DEFAULT 0,
            error_count INTEGER NOT NULL DEFAULT 0,
            last_error TEXT,
            last_error_at TIMESTAMPTZ,
            disabled_reason TEXT,
            cooldown_until TIMESTAMPTZ
          )
        `,
      )
      .then(() => sql()`ALTER TABLE ai_keys ADD COLUMN IF NOT EXISTS cooldown_until TIMESTAMPTZ`)
      .then(
        () => sql()`
          CREATE TABLE IF NOT EXISTS ai_usage (
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            day DATE NOT NULL DEFAULT CURRENT_DATE,
            count INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (user_id, day)
          )
        `,
      )
      .then(() => sql()`CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value JSONB NOT NULL)`)
      .then(() => seedEnvKeys());
    ensured.catch(() => (ensured = null));
  }
  return ensured;
}

/**
 * Keys listed in OPENROUTER_API_KEYS (comma or whitespace separated) join the pool the first time it is used. A key's id
 * comes from a hash of the key, so seeding is idempotent and never overwrites what an admin changed. To retire an
 * env key for good, remove it from the env var.
 */
async function seedEnvKeys(): Promise<void> {
  const keys = (process.env.OPENROUTER_API_KEYS ?? "")
    .split(/[\s,]+/)
    .map((k) => k.trim())
    .filter(Boolean);
  for (const [i, apiKey] of keys.entries()) {
    const id = `env_${createHash("sha256").update(apiKey).digest("hex").slice(0, 10)}`;
    await sql()`
      INSERT INTO ai_keys (id, label, key_enc, key_hint) VALUES (${id}, ${`Key ${i + 1} (env)`}, ${encryptSecret(apiKey)}, ${apiKey.slice(-4)})
      ON CONFLICT (id) DO NOTHING
    `;
  }
}

/* ---------- keys ---------- */

export async function listPoolKeys(): Promise<PoolKey[]> {
  await ensureAiTables();
  const rows = (await sql()`
    SELECT id, label, key_hint, enabled, created_at, last_used_at, request_count, error_count, last_error, last_error_at, disabled_reason, cooldown_until
    FROM ai_keys ORDER BY created_at ASC
  `) as KeyRow[];
  return rows.map(toKey);
}

export async function addPoolKey(label: string, apiKey: string): Promise<string> {
  await ensureAiTables();
  const id = newId("aikey");
  await sql()`INSERT INTO ai_keys (id, label, key_enc, key_hint) VALUES (${id}, ${label}, ${encryptSecret(apiKey)}, ${apiKey.slice(-4)})`;
  return id;
}

export async function updatePoolKey(id: string, patch: { label?: string; enabled?: boolean }): Promise<boolean> {
  await ensureAiTables();
  let found = false;
  if (patch.label !== undefined) found = ((await sql()`UPDATE ai_keys SET label = ${patch.label} WHERE id = ${id} RETURNING id`) as unknown[]).length > 0;
  if (patch.enabled !== undefined) {
    // Turning a key back on clears why it was switched off and any rest period.
    found = ((await sql()`UPDATE ai_keys SET enabled = ${patch.enabled}, disabled_reason = ${patch.enabled ? null : "Turned off by an admin."}, cooldown_until = NULL WHERE id = ${id} RETURNING id`) as unknown[]).length > 0;
  }
  return found;
}

export async function deletePoolKey(id: string): Promise<void> {
  await ensureAiTables();
  await sql()`DELETE FROM ai_keys WHERE id = ${id}`;
}

/** The decrypted key for an admin-initiated check. */
export async function getPoolKeySecret(id: string): Promise<string | null> {
  await ensureAiTables();
  const rows = (await sql()`SELECT key_enc FROM ai_keys WHERE id = ${id} LIMIT 1`) as { key_enc: string }[];
  return rows[0] ? decryptSecret(rows[0].key_enc) : null;
}

/**
 * Take the least recently used enabled key (round robin), skipping `exclude`, and count the request against it.
 * The pick and the update are one statement, so concurrent requests spread across keys.
 */
export async function takePoolKey(exclude: string[]): Promise<{ id: string; apiKey: string } | null> {
  await ensureAiTables();
  const rows = (await sql()`
    UPDATE ai_keys SET last_used_at = now(), request_count = request_count + 1
    WHERE id = (
      SELECT id FROM ai_keys
      WHERE enabled AND (cooldown_until IS NULL OR cooldown_until < now()) AND id <> ALL(${exclude}::text[])
      ORDER BY last_used_at ASC NULLS FIRST LIMIT 1
    )
    RETURNING id, key_enc
  `) as { id: string; key_enc: string }[];
  const row = rows[0];
  return row ? { id: row.id, apiKey: decryptSecret(row.key_enc) } : null;
}

/** How a failing key is handled: switched off until an admin turns it on, or rested for a while and then used again. */
export type KeyPenalty = { kind: "disable" } | { kind: "rest"; seconds: number };

/** Note a failure on a key and take it out of rotation per `penalty`, so the next request skips it without a failed call. */
export async function recordPoolKeyError(id: string, message: string, penalty: KeyPenalty): Promise<void> {
  await ensureAiTables();
  if (penalty.kind === "disable") {
    await sql()`UPDATE ai_keys SET error_count = error_count + 1, last_error = ${message}, last_error_at = now(), enabled = false, disabled_reason = ${message} WHERE id = ${id}`;
  } else {
    await sql()`
      UPDATE ai_keys SET error_count = error_count + 1, last_error = ${message}, last_error_at = now(),
        cooldown_until = now() + make_interval(secs => ${penalty.seconds})
      WHERE id = ${id}
    `;
  }
}

/* ---------- settings ---------- */

export type PresentaSettings = { enabled: boolean; model: string; dailyLimit: number };

export const DEFAULT_PRESENTA_MODEL = "openai/gpt-4o-mini";
const DEFAULT_DAILY_LIMIT = 20;

export async function getPresentaSettings(): Promise<PresentaSettings> {
  await ensureAiTables();
  const rows = (await sql()`SELECT value FROM app_settings WHERE key = 'presenta_ai' LIMIT 1`) as { value: Partial<PresentaSettings> }[];
  const v = rows[0]?.value ?? {};
  return {
    enabled: typeof v.enabled === "boolean" ? v.enabled : true,
    model: typeof v.model === "string" && v.model.trim() ? v.model.trim() : process.env.OPENROUTER_MODEL?.trim() || DEFAULT_PRESENTA_MODEL,
    dailyLimit: typeof v.dailyLimit === "number" && v.dailyLimit >= 0 ? Math.floor(v.dailyLimit) : DEFAULT_DAILY_LIMIT,
  };
}

export async function savePresentaSettings(patch: Partial<PresentaSettings>): Promise<PresentaSettings> {
  const next = { ...(await getPresentaSettings()), ...patch };
  await sql()`INSERT INTO app_settings (key, value) VALUES ('presenta_ai', ${JSON.stringify(next)}::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  return next;
}

/* ---------- daily allowance ---------- */

/** Use one request of today's allowance. `ok` is false when the allowance is spent. */
export async function reserveAllowance(userId: string, limit: number): Promise<{ ok: boolean; used: number }> {
  await ensureAiTables();
  const rows = (await sql()`
    INSERT INTO ai_usage (user_id, day, count) VALUES (${userId}, CURRENT_DATE, 1)
    ON CONFLICT (user_id, day) DO UPDATE SET count = ai_usage.count + 1 WHERE ai_usage.count < ${limit}
    RETURNING count
  `) as { count: number }[];
  if (rows[0]) return { ok: true, used: rows[0].count };
  return { ok: false, used: await usedToday(userId) };
}

export async function releaseAllowance(userId: string): Promise<void> {
  await ensureAiTables();
  await sql()`UPDATE ai_usage SET count = GREATEST(count - 1, 0) WHERE user_id = ${userId} AND day = CURRENT_DATE`;
}

export async function usedToday(userId: string): Promise<number> {
  await ensureAiTables();
  const rows = (await sql()`SELECT count FROM ai_usage WHERE user_id = ${userId} AND day = CURRENT_DATE`) as { count: number }[];
  return rows[0]?.count ?? 0;
}

export async function usageSummary(): Promise<{ requestsToday: number; usersToday: number }> {
  await ensureAiTables();
  const rows = (await sql()`SELECT COALESCE(SUM(count), 0)::int AS requests, COUNT(*)::int AS users FROM ai_usage WHERE day = CURRENT_DATE`) as { requests: number; users: number }[];
  return { requestsToday: rows[0]?.requests ?? 0, usersToday: rows[0]?.users ?? 0 };
}
