import { ensureUsersTable, sql } from "@/lib/auth/db";
import { DeckSchema, type Deck } from "@/lib/deck/schema";
import { newId } from "@/lib/deck/ids";

/** Decks and per-account settings, stored in Postgres. Every query is scoped to the signed-in user's id. */

export type DeckSummaryRow = {
  id: string;
  title: string;
  updatedAt: string;
  slideCount: number;
  themeId: string;
  trashedAt: string | null;
};

type SummaryDbRow = { id: string; title: string; updated_at: string; slide_count: number; theme_id: string; trashed_at: string | null };

const iso = (v: string | Date) => new Date(v).toISOString();

function toSummary(r: SummaryDbRow): DeckSummaryRow {
  return { id: r.id, title: r.title, updatedAt: iso(r.updated_at), slideCount: r.slide_count, themeId: r.theme_id, trashedAt: r.trashed_at ? iso(r.trashed_at) : null };
}

let ensured: Promise<void> | null = null;

/** Creates the `decks` and `user_settings` tables on first use. Safe to call repeatedly. */
export function ensureDeckTables(): Promise<void> {
  if (!ensured) {
    ensured = ensureUsersTable()
      .then(
        () => sql()`
          CREATE TABLE IF NOT EXISTS decks (
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            id TEXT NOT NULL,
            title TEXT NOT NULL,
            theme_id TEXT NOT NULL,
            slide_count INTEGER NOT NULL,
            data JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL,
            trashed_at TIMESTAMPTZ,
            PRIMARY KEY (user_id, id)
          )
        `,
      )
      .then(() => sql()`
        CREATE TABLE IF NOT EXISTS deck_versions (
          id TEXT PRIMARY KEY,
          owner_id TEXT NOT NULL,
          deck_id TEXT NOT NULL,
          created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          label TEXT NOT NULL,
          snapshot JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          FOREIGN KEY (owner_id, deck_id) REFERENCES decks(user_id, id) ON DELETE CASCADE
        )
      `)
      .then(() => sql()`CREATE INDEX IF NOT EXISTS deck_versions_deck ON deck_versions (owner_id, deck_id, created_at DESC)`)
      .then(() => sql()`ALTER TABLE decks ADD COLUMN IF NOT EXISTS folder_id TEXT`)
      .then(() => sql()`ALTER TABLE decks ADD COLUMN IF NOT EXISTS size_bytes INTEGER NOT NULL DEFAULT 0`)
      // Decks saved before sizes were tracked get theirs filled in once; afterwards this touches no rows.
      .then(() => sql()`UPDATE decks SET size_bytes = octet_length(data::text) WHERE size_bytes = 0`)
      .then(() => sql()`CREATE INDEX IF NOT EXISTS decks_user_updated ON decks (user_id, updated_at DESC)`)
      .then(
        () => sql()`
          CREATE TABLE IF NOT EXISTS user_settings (
            user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            brand_kit JSONB,
            starred JSONB,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        `,
      )
      .then(() => undefined);
    ensured.catch(() => (ensured = null));
  }
  return ensured;
}

/** Decks in the list (`trashed` false) or in the trash (`trashed` true), newest first. */
export async function listDeckRows(userId: string, trashed: boolean): Promise<DeckSummaryRow[]> {
  await ensureDeckTables();
  const rows = (trashed
    ? await sql()`SELECT id, title, updated_at, slide_count, theme_id, trashed_at FROM decks WHERE user_id = ${userId} AND trashed_at IS NOT NULL ORDER BY trashed_at DESC`
    : await sql()`SELECT id, title, updated_at, slide_count, theme_id, trashed_at FROM decks WHERE user_id = ${userId} AND trashed_at IS NULL ORDER BY updated_at DESC`) as SummaryDbRow[];
  return rows.map(toSummary);
}

/** Every deck id the user has, in the list or the trash. */
export async function listAllDeckIds(userId: string): Promise<string[]> {
  await ensureDeckTables();
  const rows = (await sql()`SELECT id FROM decks WHERE user_id = ${userId}`) as { id: string }[];
  return rows.map((r) => r.id);
}

/** The full deck (trashed decks included, so the trash can still be previewed), or null. */
export async function getDeckData(userId: string, id: string): Promise<unknown | null> {
  await ensureDeckTables();
  const rows = (await sql()`SELECT data FROM decks WHERE user_id = ${userId} AND id = ${id} LIMIT 1`) as { data: unknown }[];
  return rows[0]?.data ?? null;
}

/** Insert or replace a deck. A save never changes whether the deck is in the trash. */
export async function upsertDeck(userId: string, deck: Deck): Promise<void> {
  await ensureDeckTables();
  const json = JSON.stringify(deck);
  const size = Buffer.byteLength(json);
  await sql()`
    INSERT INTO decks (user_id, id, title, theme_id, slide_count, data, size_bytes, created_at, updated_at)
    VALUES (${userId}, ${deck.id}, ${deck.title}, ${deck.themeId}, ${deck.slides.length}, ${json}::jsonb, ${size}, ${deck.createdAt}, ${deck.updatedAt})
    ON CONFLICT (user_id, id) DO UPDATE SET
      title = EXCLUDED.title,
      theme_id = EXCLUDED.theme_id,
      slide_count = EXCLUDED.slide_count,
      data = EXCLUDED.data,
      size_bytes = EXCLUDED.size_bytes,
      updated_at = EXCLUDED.updated_at
  `;
}

/** Replace the content of an existing deck (an editor saving someone else's deck). Never creates a deck. Returns false if there is none. */
export async function updateDeckContent(ownerId: string, deck: Deck): Promise<boolean> {
  await ensureDeckTables();
  const json = JSON.stringify(deck);
  const rows = (await sql()`
    UPDATE decks SET title = ${deck.title}, theme_id = ${deck.themeId}, slide_count = ${deck.slides.length}, data = ${json}::jsonb, size_bytes = ${Buffer.byteLength(json)}, updated_at = ${deck.updatedAt}
    WHERE user_id = ${ownerId} AND id = ${deck.id} AND trashed_at IS NULL RETURNING id
  `) as { id: string }[];
  return rows.length > 0;
}

/** Replace deck content only if nobody has saved since the caller read expectedUpdatedAt. */
export async function compareAndSwapDeckContent(ownerId: string, deck: Deck, expectedUpdatedAt: string): Promise<boolean> {
  await ensureDeckTables();
  const json = JSON.stringify(deck);
  const rows = (await sql()`
    UPDATE decks SET title = ${deck.title}, theme_id = ${deck.themeId}, slide_count = ${deck.slides.length}, data = ${json}::jsonb, size_bytes = ${Buffer.byteLength(json)}, updated_at = ${deck.updatedAt}
    WHERE user_id = ${ownerId} AND id = ${deck.id} AND trashed_at IS NULL AND updated_at = ${expectedUpdatedAt}::timestamptz
    RETURNING id
  `) as { id: string }[];
  return rows.length > 0;
}

export type DeckVersionSummary = { id: string; createdBy: string; name: string; label: string; createdAt: string };

/** Store a named snapshot of the current deck. Keeps the newest 100 versions for this deck. */
export async function createDeckVersion(ownerId: string, deckId: string, userId: string, label: string): Promise<string> {
  await ensureDeckTables();
  const rows = (await sql()`SELECT data FROM decks WHERE user_id = ${ownerId} AND id = ${deckId} AND trashed_at IS NULL`) as { data: unknown }[];
  if (!rows[0]) throw new Error("Deck not found.");
  const id = newId("version");
  const cleanLabel = label.trim().replace(/\s+/g, " ").slice(0, 80) || "Checkpoint";
  await sql()`INSERT INTO deck_versions (id, owner_id, deck_id, created_by, label, snapshot) VALUES (${id}, ${ownerId}, ${deckId}, ${userId}, ${cleanLabel}, ${JSON.stringify(rows[0].data)}::jsonb)`;
  await sql()`DELETE FROM deck_versions WHERE owner_id = ${ownerId} AND deck_id = ${deckId} AND id IN (SELECT id FROM deck_versions WHERE owner_id = ${ownerId} AND deck_id = ${deckId} ORDER BY created_at DESC, id DESC OFFSET 100)`;
  return id;
}

/** Save one automatic checkpoint every five minutes of active editing. */
export async function createAutoDeckVersion(ownerId: string, deckId: string, userId: string): Promise<void> {
  await ensureDeckTables();
  const due = (await sql()`SELECT 1 FROM deck_versions WHERE owner_id = ${ownerId} AND deck_id = ${deckId} AND created_at > now() - interval '5 minutes' LIMIT 1`) as unknown[];
  if (!due.length) await createDeckVersion(ownerId, deckId, userId, "Autosaved checkpoint");
}

export async function listDeckVersions(ownerId: string, deckId: string): Promise<DeckVersionSummary[]> {
  await ensureDeckTables();
  const rows = (await sql()`
    SELECT v.id, v.created_by, COALESCE(u.name, u.email) AS name, v.label, v.created_at
    FROM deck_versions v JOIN users u ON u.id = v.created_by
    WHERE v.owner_id = ${ownerId} AND v.deck_id = ${deckId}
    ORDER BY v.created_at DESC, v.id DESC LIMIT 100
  `) as { id: string; created_by: string; name: string; label: string; created_at: string | Date }[];
  return rows.map((r) => ({ id: r.id, createdBy: r.created_by, name: r.name, label: r.label, createdAt: iso(r.created_at) }));
}

export async function getDeckVersion(ownerId: string, deckId: string, versionId: string): Promise<Deck | null> {
  await ensureDeckTables();
  const rows = (await sql()`SELECT snapshot FROM deck_versions WHERE owner_id = ${ownerId} AND deck_id = ${deckId} AND id = ${versionId} LIMIT 1`) as { snapshot: unknown }[];
  if (!rows[0]) return null;
  const parsed = DeckSchema.safeParse(rows[0].snapshot);
  return parsed.success ? parsed.data : null;
}

/** Move a deck to the trash or back. Returns false if the user has no such deck. */
export async function setDeckTrashed(userId: string, id: string, trashed: boolean): Promise<boolean> {
  await ensureDeckTables();
  const rows = (trashed
    ? await sql()`UPDATE decks SET trashed_at = now() WHERE user_id = ${userId} AND id = ${id} RETURNING id`
    : await sql()`UPDATE decks SET trashed_at = NULL WHERE user_id = ${userId} AND id = ${id} RETURNING id`) as { id: string }[];
  return rows.length > 0;
}

export async function deleteDeckRow(userId: string, id: string): Promise<void> {
  await ensureDeckTables();
  await sql()`DELETE FROM decks WHERE user_id = ${userId} AND id = ${id}`;
}

export async function emptyTrashRows(userId: string): Promise<void> {
  await ensureDeckTables();
  await sql()`DELETE FROM decks WHERE user_id = ${userId} AND trashed_at IS NOT NULL`;
}

/** Remove decks that have sat in the trash past the retention window. */
export async function purgeExpiredTrash(userId: string, days: number): Promise<void> {
  await ensureDeckTables();
  await sql()`DELETE FROM decks WHERE user_id = ${userId} AND trashed_at IS NOT NULL AND trashed_at < now() - make_interval(days => ${days})`;
}

/* ---------- settings ---------- */

export type UserSettings = { brandKit: unknown | null; starred: string[] | null };

export async function getSettings(userId: string): Promise<UserSettings> {
  await ensureDeckTables();
  const rows = (await sql()`SELECT brand_kit, starred FROM user_settings WHERE user_id = ${userId} LIMIT 1`) as { brand_kit: unknown; starred: unknown }[];
  const row = rows[0];
  return { brandKit: row?.brand_kit ?? null, starred: Array.isArray(row?.starred) ? (row.starred as string[]) : null };
}

/** Save the parts that are present; a part set to null clears it. Parts left undefined are untouched. */
export async function saveSettings(userId: string, patch: { brandKit?: unknown | null; starred?: string[] | null }): Promise<void> {
  await ensureDeckTables();
  await sql()`INSERT INTO user_settings (user_id) VALUES (${userId}) ON CONFLICT (user_id) DO NOTHING`;
  if (patch.brandKit !== undefined) {
    const v = patch.brandKit === null ? null : JSON.stringify(patch.brandKit);
    await sql()`UPDATE user_settings SET brand_kit = ${v}::jsonb, updated_at = now() WHERE user_id = ${userId}`;
  }
  if (patch.starred !== undefined) {
    const v = patch.starred === null ? null : JSON.stringify(patch.starred);
    await sql()`UPDATE user_settings SET starred = ${v}::jsonb, updated_at = now() WHERE user_id = ${userId}`;
  }
}
