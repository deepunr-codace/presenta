import { ensureUsersTable, sql } from "@/lib/auth/db";

/** Media library rows: who owns which R2 object. The files themselves live in R2. */

export const MEDIA_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"] as const;
export const MEDIA_VIDEO_TYPES = ["video/mp4", "video/webm"] as const;
export const MEDIA_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const MEDIA_VIDEO_MAX_BYTES = 100 * 1024 * 1024;
export const MEDIA_THUMB_MAX_BYTES = 512 * 1024;

export type MediaRow = {
  id: string;
  user_id: string;
  name: string;
  kind: "image" | "video";
  mime: string;
  bytes: number;
  width: number;
  height: number;
  duration: number | null;
  key: string;
  thumb_key: string;
  created_at: string;
};

let ensured: Promise<void> | null = null;

/** Creates the `media` table on first use. Safe to call repeatedly. */
export function ensureMediaTable(): Promise<void> {
  if (!ensured) {
    ensured = ensureUsersTable()
      .then(
        () => sql()`
          CREATE TABLE IF NOT EXISTS media (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            kind TEXT NOT NULL,
            mime TEXT NOT NULL,
            bytes BIGINT NOT NULL,
            width INTEGER NOT NULL,
            height INTEGER NOT NULL,
            duration REAL,
            key TEXT NOT NULL,
            thumb_key TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        `,
      )
      .then(() => sql()`CREATE INDEX IF NOT EXISTS media_user_created ON media (user_id, created_at DESC)`)
      .then(() => undefined);
    ensured.catch(() => (ensured = null));
  }
  return ensured;
}

export async function listMediaRows(userId: string): Promise<MediaRow[]> {
  await ensureMediaTable();
  return (await sql()`SELECT * FROM media WHERE user_id = ${userId} ORDER BY created_at DESC`) as MediaRow[];
}

export async function insertMediaRow(row: Omit<MediaRow, "created_at">): Promise<void> {
  await ensureMediaTable();
  await sql()`
    INSERT INTO media (id, user_id, name, kind, mime, bytes, width, height, duration, key, thumb_key)
    VALUES (${row.id}, ${row.user_id}, ${row.name}, ${row.kind}, ${row.mime}, ${row.bytes}, ${row.width}, ${row.height}, ${row.duration}, ${row.key}, ${row.thumb_key})
  `;
}

/** Deletes a row the user owns and returns it (so its files can be removed), or null if it is not theirs. */
export async function deleteMediaRow(userId: string, id: string): Promise<MediaRow | null> {
  await ensureMediaTable();
  const rows = (await sql()`DELETE FROM media WHERE id = ${id} AND user_id = ${userId} RETURNING *`) as MediaRow[];
  return rows[0] ?? null;
}
