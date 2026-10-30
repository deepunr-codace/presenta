import { createHash, randomBytes } from "node:crypto";
import { sql } from "@/lib/auth/db";
import { ensureDeckTables } from "@/lib/decks-db";

export type RemoteControlState = {
  slideIndex: number;
  slideCount: number;
  revision: number;
  expiresAt: string;
};

let ensured: Promise<void> | null = null;

function ensureRemoteTable(): Promise<void> {
  if (!ensured) {
    ensured = ensureDeckTables().then(async () => {
      await sql()`
        CREATE TABLE IF NOT EXISTS presentation_remote_sessions (
          owner_id TEXT NOT NULL,
          deck_id TEXT NOT NULL,
          token_hash TEXT NOT NULL UNIQUE,
          slide_index INTEGER NOT NULL DEFAULT 0,
          slide_count INTEGER NOT NULL,
          revision BIGINT NOT NULL DEFAULT 0,
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          PRIMARY KEY (owner_id, deck_id),
          FOREIGN KEY (owner_id, deck_id) REFERENCES decks(user_id, id) ON DELETE CASCADE
        )
      `;
      await sql()`CREATE INDEX IF NOT EXISTS presentation_remote_expiry ON presentation_remote_sessions (expires_at)`;
    });
    ensured.catch(() => { ensured = null; });
  }
  return ensured;
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function toState(row: { slide_index: number; slide_count: number; revision: string | number | bigint; expires_at: string | Date }): RemoteControlState {
  return {
    slideIndex: Number(row.slide_index),
    slideCount: Number(row.slide_count),
    revision: Number(row.revision),
    expiresAt: new Date(row.expires_at).toISOString(),
  };
}

/** Store only a hash of the bearer token; a fresh session invalidates the previous remote for this deck. */
export async function createRemoteSession(ownerId: string, deckId: string, slideCount: number, slideIndex: number): Promise<{ token: string; state: RemoteControlState }> {
  await ensureRemoteTable();
  const token = randomBytes(32).toString("base64url");
  const rows = (await sql()`
    INSERT INTO presentation_remote_sessions (owner_id, deck_id, token_hash, slide_index, slide_count, revision, expires_at)
    VALUES (${ownerId}, ${deckId}, ${tokenHash(token)}, ${slideIndex}, ${slideCount}, 0, now() + interval '1 hour')
    ON CONFLICT (owner_id, deck_id) DO UPDATE SET
      token_hash = EXCLUDED.token_hash,
      slide_index = EXCLUDED.slide_index,
      slide_count = EXCLUDED.slide_count,
      revision = 0,
      expires_at = EXCLUDED.expires_at,
      created_at = now()
    RETURNING slide_index, slide_count, revision, expires_at
  `) as { slide_index: number; slide_count: number; revision: string | number | bigint; expires_at: string | Date }[];
  if (!rows[0]) throw new Error("Remote-control session was not saved.");
  return { token, state: toState(rows[0]) };
}

export async function getRemoteSession(token: string): Promise<RemoteControlState | null> {
  await ensureRemoteTable();
  const rows = (await sql()`
    SELECT slide_index, slide_count, revision, expires_at
    FROM presentation_remote_sessions
    WHERE token_hash = ${tokenHash(token)} AND expires_at > now()
    LIMIT 1
  `) as { slide_index: number; slide_count: number; revision: string | number | bigint; expires_at: string | Date }[];
  return rows[0] ? toState(rows[0]) : null;
}

export async function setRemoteSlide(token: string, slideIndex: number): Promise<RemoteControlState | null> {
  await ensureRemoteTable();
  const current = await getRemoteSession(token);
  if (!current || slideIndex < 0 || slideIndex >= current.slideCount) return null;
  if (current.slideIndex === slideIndex) return current;
  const rows = (await sql()`
    UPDATE presentation_remote_sessions
    SET slide_index = ${slideIndex}, revision = revision + 1
    WHERE token_hash = ${tokenHash(token)} AND expires_at > now() AND slide_count > ${slideIndex}
    RETURNING slide_index, slide_count, revision, expires_at
  `) as { slide_index: number; slide_count: number; revision: string | number | bigint; expires_at: string | Date }[];
  if (rows[0]) return toState(rows[0]);
  return getRemoteSession(token);
}

export async function revokeRemoteSession(ownerId: string, deckId: string): Promise<void> {
  await ensureRemoteTable();
  await sql()`DELETE FROM presentation_remote_sessions WHERE owner_id = ${ownerId} AND deck_id = ${deckId}`;
}
