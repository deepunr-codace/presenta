import { sql } from "@/lib/auth/db";
import { ensureDeckTables } from "@/lib/decks-db";
import { ensureMediaTable } from "@/lib/media-db";

/**
 * Each account has a fixed amount of storage, like a small hard drive: its decks (trash included, until it is emptied)
 * plus the images and videos in its media library. 100 MB unless STORAGE_LIMIT_MB says otherwise. Server only.
 */

export const STORAGE_LIMIT_BYTES = (Number(process.env.STORAGE_LIMIT_MB) || 100) * 1024 * 1024;

export type StorageUsage = {
  used: number;
  limit: number;
  decks: { bytes: number; count: number };
  media: { bytes: number; count: number };
};

export async function getStorageUsage(userId: string): Promise<StorageUsage> {
  await Promise.all([ensureDeckTables(), ensureMediaTable()]);
  const [d, m] = await Promise.all([
    sql()`SELECT COALESCE(SUM(size_bytes), 0)::bigint AS bytes, COUNT(*)::int AS n FROM decks WHERE user_id = ${userId}`,
    sql()`SELECT COALESCE(SUM(bytes), 0)::bigint AS bytes, COUNT(*)::int AS n FROM media WHERE user_id = ${userId}`,
  ]);
  const decks = { bytes: Number((d as { bytes: string }[])[0].bytes), count: (d as { n: number }[])[0].n };
  const media = { bytes: Number((m as { bytes: string }[])[0].bytes), count: (m as { n: number }[])[0].n };
  return { used: decks.bytes + media.bytes, limit: STORAGE_LIMIT_BYTES, decks, media };
}

export class StorageFullError extends Error {
  readonly status = 413;
  readonly code = "storage_full";
  constructor(limit: number) {
    super(`Your storage is full (${Math.round(limit / 1024 / 1024)} MB). Delete decks or media you no longer need, empty the trash, or ask for more space.`);
    this.name = "StorageFullError";
  }
}

/**
 * Refuse a write that would push the account over its limit. `replacing` is the size of what the write replaces, so
 * editing a deck only counts the growth, and a save that shrinks a deck is always allowed.
 */
export async function assertRoom(userId: string, adding: number, replacing = 0): Promise<void> {
  if (adding <= replacing) return;
  const { used, limit } = await getStorageUsage(userId);
  if (used - replacing + adding > limit) throw new StorageFullError(limit);
}

/** Current size of one deck, or 0 if it does not exist yet. */
export async function deckSize(userId: string, deckId: string): Promise<number> {
  await ensureDeckTables();
  const rows = (await sql()`SELECT size_bytes FROM decks WHERE user_id = ${userId} AND id = ${deckId}`) as { size_bytes: number }[];
  return rows[0]?.size_bytes ?? 0;
}
