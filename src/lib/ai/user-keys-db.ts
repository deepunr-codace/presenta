import { ensureUsersTable, sql } from "@/lib/auth/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import type { AiProvider } from "./auth";

/**
 * AI keys an admin assigns to one user: an OpenAI, Anthropic or Gemini key the user's own requests are served with,
 * without the user ever seeing it. Encrypted at rest, decrypted only for the request. Server only.
 */

export type AssignedKey = { provider: AiProvider; hint: string; setBy: string; updatedAt: string };

/** Which assigned key serves when a user has several. */
export const ASSIGNED_ORDER: AiProvider[] = ["openai", "anthropic", "gemini"];

let ensured: Promise<void> | null = null;

export function ensureUserKeysTable(): Promise<void> {
  if (!ensured) {
    ensured = ensureUsersTable()
      .then(
        () => sql()`
          CREATE TABLE IF NOT EXISTS user_ai_keys (
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            provider TEXT NOT NULL,
            key_enc TEXT NOT NULL,
            key_hint TEXT NOT NULL,
            set_by TEXT NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (user_id, provider)
          )
        `,
      )
      .then(() => undefined);
    ensured.catch(() => (ensured = null));
  }
  return ensured;
}

type Row = { provider: AiProvider; key_hint: string; set_by: string; updated_at: string };

export async function listAssignedKeys(userId: string): Promise<AssignedKey[]> {
  await ensureUserKeysTable();
  const rows = (await sql()`SELECT provider, key_hint, set_by, updated_at FROM user_ai_keys WHERE user_id = ${userId}`) as Row[];
  return rows.map((r) => ({ provider: r.provider, hint: r.key_hint, setBy: r.set_by, updatedAt: new Date(r.updated_at).toISOString() })).sort((a, b) => ASSIGNED_ORDER.indexOf(a.provider) - ASSIGNED_ORDER.indexOf(b.provider));
}

export async function setAssignedKey(userId: string, provider: AiProvider, apiKey: string, setBy: string): Promise<void> {
  await ensureUserKeysTable();
  await sql()`
    INSERT INTO user_ai_keys (user_id, provider, key_enc, key_hint, set_by, updated_at)
    VALUES (${userId}, ${provider}, ${encryptSecret(apiKey)}, ${apiKey.slice(-4)}, ${setBy}, now())
    ON CONFLICT (user_id, provider) DO UPDATE SET key_enc = EXCLUDED.key_enc, key_hint = EXCLUDED.key_hint, set_by = EXCLUDED.set_by, updated_at = now()
  `;
}

export async function removeAssignedKey(userId: string, provider: AiProvider): Promise<void> {
  await ensureUserKeysTable();
  await sql()`DELETE FROM user_ai_keys WHERE user_id = ${userId} AND provider = ${provider}`;
}

/** The key that serves this user's requests: the first assigned provider in `ASSIGNED_ORDER`, or null. */
export async function assignedKeyFor(userId: string): Promise<{ provider: AiProvider; apiKey: string } | null> {
  await ensureUserKeysTable();
  const rows = (await sql()`SELECT provider, key_enc FROM user_ai_keys WHERE user_id = ${userId}`) as { provider: AiProvider; key_enc: string }[];
  const row = rows.sort((a, b) => ASSIGNED_ORDER.indexOf(a.provider) - ASSIGNED_ORDER.indexOf(b.provider))[0];
  return row ? { provider: row.provider, apiKey: decryptSecret(row.key_enc) } : null;
}
