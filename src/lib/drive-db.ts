import { sql } from "@/lib/auth/db";
import { CollabError, ensureCollabTables } from "@/lib/collab-db";
import { newId } from "@/lib/deck/ids";

/**
 * The "hard drive" side of the account: folders, the deck list with its sharing summary, and view tracking for
 * analytics. Server only.
 */

/* ======================= Tables ======================= */

let ensured: Promise<void> | null = null;

export function ensureDriveTables(): Promise<void> {
  if (!ensured) {
    ensured = ensureCollabTables()
      .then(
        () => sql()`
          CREATE TABLE IF NOT EXISTS folders (
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            id TEXT NOT NULL,
            name TEXT NOT NULL,
            parent_id TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (user_id, id)
          )
        `,
      )
      .then(
        () => sql()`
          CREATE TABLE IF NOT EXISTS deck_events (
            id BIGSERIAL PRIMARY KEY,
            owner_id TEXT NOT NULL,
            deck_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            kind TEXT NOT NULL,
            at TIMESTAMPTZ NOT NULL DEFAULT now(),
            FOREIGN KEY (owner_id, deck_id) REFERENCES decks(user_id, id) ON DELETE CASCADE
          )
        `,
      )
      .then(() => sql()`CREATE INDEX IF NOT EXISTS deck_events_deck ON deck_events (owner_id, deck_id, at DESC)`)
      .then(() => undefined);
    ensured.catch(() => (ensured = null));
  }
  return ensured;
}

/* ======================= Folders ======================= */

export type Folder = { id: string; name: string; parentId: string | null; createdAt: string; deckCount: number };

const MAX_DEPTH = 8;
const iso = (v: string | Date) => new Date(v).toISOString();

type FolderRow = { id: string; name: string; parent_id: string | null; created_at: string; deck_count: number };

export async function listFolders(userId: string): Promise<Folder[]> {
  await ensureDriveTables();
  const rows = (await sql()`
    SELECT f.id, f.name, f.parent_id, f.created_at,
      (SELECT COUNT(*)::int FROM decks d WHERE d.user_id = f.user_id AND d.folder_id = f.id AND d.trashed_at IS NULL) AS deck_count
    FROM folders f WHERE f.user_id = ${userId} ORDER BY lower(f.name)
  `) as FolderRow[];
  return rows.map((r) => ({ id: r.id, name: r.name, parentId: r.parent_id, createdAt: iso(r.created_at), deckCount: r.deck_count }));
}

function cleanName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) throw new CollabError("Give the folder a name.");
  if (name.length > 60) throw new CollabError("Folder names can be up to 60 characters.");
  if (/[\\/]/.test(name)) throw new CollabError("Folder names cannot contain slashes.");
  return name;
}

const depthOf = (folders: Folder[], id: string | null): number => {
  let depth = 0;
  for (let cur = id; cur; depth += 1) cur = folders.find((f) => f.id === cur)?.parentId ?? null;
  return depth;
};

/** The folder and everything inside it, so a folder cannot be moved into itself. */
const descendants = (folders: Folder[], id: string): Set<string> => {
  const out = new Set([id]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const f of folders) {
      if (f.parentId && out.has(f.parentId) && !out.has(f.id)) {
        out.add(f.id);
        grew = true;
      }
    }
  }
  return out;
};

function assertFreeName(folders: Folder[], parentId: string | null, name: string, exceptId?: string) {
  const clash = folders.some((f) => f.id !== exceptId && f.parentId === parentId && f.name.toLowerCase() === name.toLowerCase());
  if (clash) throw new CollabError(`A folder named "${name}" already exists here.`, 409);
}

export async function createFolder(userId: string, rawName: string, parentId: string | null): Promise<Folder> {
  const name = cleanName(rawName);
  const folders = await listFolders(userId);
  if (parentId && !folders.some((f) => f.id === parentId)) throw new CollabError("That folder was not found.", 404);
  if (depthOf(folders, parentId) >= MAX_DEPTH) throw new CollabError(`Folders can be nested up to ${MAX_DEPTH} levels deep.`);
  assertFreeName(folders, parentId, name);
  const id = newId("folder");
  await sql()`INSERT INTO folders (user_id, id, name, parent_id) VALUES (${userId}, ${id}, ${name}, ${parentId})`;
  return { id, name, parentId, createdAt: new Date().toISOString(), deckCount: 0 };
}

/** Rename a folder and/or move it under another folder (`parentId: null` moves it to the top). */
export async function updateFolder(userId: string, id: string, patch: { name?: string; parentId?: string | null }): Promise<void> {
  const folders = await listFolders(userId);
  const folder = folders.find((f) => f.id === id);
  if (!folder) throw new CollabError("That folder was not found.", 404);
  const name = patch.name === undefined ? folder.name : cleanName(patch.name);
  const parentId = patch.parentId === undefined ? folder.parentId : patch.parentId;
  if (parentId) {
    if (!folders.some((f) => f.id === parentId)) throw new CollabError("That folder was not found.", 404);
    if (descendants(folders, id).has(parentId)) throw new CollabError("A folder cannot be moved into itself.");
  }
  if (depthOf(folders, parentId) + 1 > MAX_DEPTH) throw new CollabError(`Folders can be nested up to ${MAX_DEPTH} levels deep.`);
  assertFreeName(folders, parentId, name, id);
  await sql()`UPDATE folders SET name = ${name}, parent_id = ${parentId} WHERE user_id = ${userId} AND id = ${id}`;
}

/** Delete a folder. Its decks and sub-folders move up to its parent, so nothing is lost. */
export async function deleteFolder(userId: string, id: string): Promise<void> {
  const folders = await listFolders(userId);
  const folder = folders.find((f) => f.id === id);
  if (!folder) throw new CollabError("That folder was not found.", 404);
  const parent = folder.parentId;
  for (const child of folders.filter((f) => f.parentId === id)) {
    // A moved sub-folder must not collide with a sibling name at the new level.
    let name = child.name;
    for (let n = 2; folders.some((f) => f.id !== child.id && f.parentId === parent && f.name.toLowerCase() === name.toLowerCase()); n += 1) name = `${child.name} (${n})`;
    await sql()`UPDATE folders SET parent_id = ${parent}, name = ${name} WHERE user_id = ${userId} AND id = ${child.id}`;
  }
  await sql()`UPDATE decks SET folder_id = ${parent} WHERE user_id = ${userId} AND folder_id = ${id}`;
  await sql()`DELETE FROM folders WHERE user_id = ${userId} AND id = ${id}`;
}

/** Put one of my decks in a folder, or back at the top (`folderId: null`). */
export async function moveDeck(userId: string, deckId: string, folderId: string | null): Promise<void> {
  await ensureDriveTables();
  if (folderId) {
    const ok = (await sql()`SELECT 1 FROM folders WHERE user_id = ${userId} AND id = ${folderId}`) as unknown[];
    if (!ok.length) throw new CollabError("That folder was not found.", 404);
  }
  const rows = (await sql()`UPDATE decks SET folder_id = ${folderId} WHERE user_id = ${userId} AND id = ${deckId} RETURNING id`) as unknown[];
  if (!rows.length) throw new CollabError("That deck was not found.", 404);
}

/* ======================= Deck list with sharing ======================= */

export type DriveDeck = {
  id: string;
  title: string;
  updatedAt: string;
  slideCount: number;
  themeId: string;
  folderId: string | null;
  sizeBytes: number;
  sharing: {
    /** People (not teams) the deck is shared with directly. */
    people: number;
    names: string[];
    teamIds: string[];
    link: "restricted" | "anyone_view";
    /** Others who have opened it through the link. */
    linkViewers: number;
  };
};

type DriveRow = {
  id: string;
  title: string;
  updated_at: string;
  slide_count: number;
  theme_id: string;
  folder_id: string | null;
  size_bytes: number;
  people: number;
  link_viewers: number;
  team_ids: string[];
  names: string[];
  link_access: "restricted" | "anyone_view";
};

/** My decks (not in the trash), each with who it is shared with. */
export async function listDriveDecks(userId: string): Promise<DriveDeck[]> {
  await ensureDriveTables();
  const rows = (await sql()`
    SELECT d.id, d.title, d.updated_at, d.slide_count, d.theme_id, d.folder_id, d.size_bytes,
      (SELECT COUNT(*)::int FROM deck_shares s WHERE s.owner_id = d.user_id AND s.deck_id = d.id AND s.kind = 'user' AND NOT s.via_link) AS people,
      (SELECT COUNT(*)::int FROM deck_shares s WHERE s.owner_id = d.user_id AND s.deck_id = d.id AND s.via_link) AS link_viewers,
      COALESCE((SELECT array_agg(s.grantee_id) FROM deck_shares s WHERE s.owner_id = d.user_id AND s.deck_id = d.id AND s.kind = 'team'), ARRAY[]::text[]) AS team_ids,
      COALESCE((SELECT array_agg(COALESCE(u.name, u.email) ORDER BY s.created_at) FROM deck_shares s JOIN users u ON u.id = s.grantee_id
        WHERE s.owner_id = d.user_id AND s.deck_id = d.id AND s.kind = 'user' AND NOT s.via_link), ARRAY[]::text[]) AS names,
      COALESCE((SELECT l.access FROM deck_links l WHERE l.owner_id = d.user_id AND l.deck_id = d.id), 'restricted') AS link_access
    FROM decks d WHERE d.user_id = ${userId} AND d.trashed_at IS NULL ORDER BY d.updated_at DESC
  `) as DriveRow[];
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    updatedAt: iso(r.updated_at),
    slideCount: r.slide_count,
    themeId: r.theme_id,
    folderId: r.folder_id,
    sizeBytes: r.size_bytes,
    sharing: { people: r.people, names: r.names.slice(0, 5), teamIds: r.team_ids, link: r.link_access, linkViewers: r.link_viewers },
  }));
}

/* ======================= Views and analytics ======================= */

export type EventKind = "view" | "present";

/** Note that someone opened a deck. The same person opening the same deck again within 30 minutes counts once. */
export async function recordEvent(ownerId: string, deckId: string, userId: string, kind: EventKind): Promise<void> {
  await ensureDriveTables();
  await sql()`
    INSERT INTO deck_events (owner_id, deck_id, user_id, kind)
    SELECT ${ownerId}, ${deckId}, ${userId}, ${kind}
    WHERE NOT EXISTS (
      SELECT 1 FROM deck_events WHERE owner_id = ${ownerId} AND deck_id = ${deckId} AND user_id = ${userId} AND kind = ${kind} AND at > now() - interval '30 minutes'
    )
  `;
}

/** Record anonymous public-link analytics with a browser-generated, non-identifying visitor id. */
export async function recordPublicEvent(linkToken: string, visitorId: string, kind: EventKind): Promise<boolean> {
  await ensureDriveTables();
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(linkToken) || !/^[0-9a-f-]{36}$/i.test(visitorId)) return false;
  const rows = (await sql()`
    SELECT l.owner_id, l.deck_id FROM deck_links l
    JOIN decks d ON d.user_id = l.owner_id AND d.id = l.deck_id
    WHERE l.token = ${linkToken} AND l.access = 'anyone_view' AND (l.expires_at IS NULL OR l.expires_at > now()) AND d.trashed_at IS NULL
    LIMIT 1
  `) as { owner_id: string; deck_id: string }[];
  if (!rows[0]) return false;
  await recordEvent(rows[0].owner_id, rows[0].deck_id, `public:${visitorId}`, kind);
  return true;
}

export type Analytics = {
  days: number;
  totals: { decks: number; slides: number; sharedDecks: number; views: number; viewsByOthers: number; uniqueViewers: number; presentations: number };
  daily: { day: string; views: number; presentations: number }[];
  decks: { id: string; title: string; views: number; viewsByOthers: number; uniqueViewers: number; presentations: number; lastViewedAt: string | null; people: number }[];
};

export async function getAnalytics(userId: string, days: number): Promise<Analytics> {
  await ensureDriveTables();
  const [t, daily, perDeck] = await Promise.all([
    sql()`
      SELECT
        (SELECT COUNT(*)::int FROM decks WHERE user_id = ${userId} AND trashed_at IS NULL) AS decks,
        (SELECT COALESCE(SUM(slide_count), 0)::int FROM decks WHERE user_id = ${userId} AND trashed_at IS NULL) AS slides,
        (SELECT COUNT(DISTINCT deck_id)::int FROM deck_shares WHERE owner_id = ${userId}) AS shared_decks,
        COUNT(*) FILTER (WHERE kind = 'view')::int AS views,
        COUNT(*) FILTER (WHERE kind = 'view' AND user_id <> ${userId})::int AS views_others,
        COUNT(DISTINCT user_id) FILTER (WHERE user_id <> ${userId})::int AS unique_viewers,
        COUNT(*) FILTER (WHERE kind = 'present')::int AS presentations
      FROM deck_events WHERE owner_id = ${userId} AND at > now() - make_interval(days => ${days})
    `,
    sql()`
      SELECT (at AT TIME ZONE 'UTC')::date::text AS day,
        COUNT(*) FILTER (WHERE kind = 'view')::int AS views, COUNT(*) FILTER (WHERE kind = 'present')::int AS presentations
      FROM deck_events WHERE owner_id = ${userId} AND at > now() - make_interval(days => ${days}) GROUP BY 1
    `,
    sql()`
      SELECT d.id, d.title,
        COUNT(e.id) FILTER (WHERE e.kind = 'view')::int AS views,
        COUNT(e.id) FILTER (WHERE e.kind = 'view' AND e.user_id <> d.user_id)::int AS views_others,
        COUNT(DISTINCT e.user_id) FILTER (WHERE e.user_id <> d.user_id)::int AS unique_viewers,
        COUNT(e.id) FILTER (WHERE e.kind = 'present')::int AS presentations,
        MAX(e.at) FILTER (WHERE e.kind = 'view') AS last_viewed,
        (SELECT COUNT(*)::int FROM deck_shares s WHERE s.owner_id = d.user_id AND s.deck_id = d.id) AS people
      FROM decks d LEFT JOIN deck_events e ON e.owner_id = d.user_id AND e.deck_id = d.id AND e.at > now() - make_interval(days => ${days})
      WHERE d.user_id = ${userId} AND d.trashed_at IS NULL
      GROUP BY d.id, d.title, d.user_id ORDER BY views_others DESC, views DESC, d.title LIMIT 25
    `,
  ]);
  const tot = (t as Record<string, number>[])[0];
  const byDay = new Map((daily as { day: string; views: number; presentations: number }[]).map((r) => [r.day, r]));
  const series: Analytics["daily"] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    series.push({ day, views: byDay.get(day)?.views ?? 0, presentations: byDay.get(day)?.presentations ?? 0 });
  }
  return {
    days,
    totals: { decks: tot.decks, slides: tot.slides, sharedDecks: tot.shared_decks, views: tot.views, viewsByOthers: tot.views_others, uniqueViewers: tot.unique_viewers, presentations: tot.presentations },
    daily: series,
    decks: (perDeck as { id: string; title: string; views: number; views_others: number; unique_viewers: number; presentations: number; last_viewed: string | null; people: number }[]).map((r) => ({
      id: r.id,
      title: r.title,
      views: r.views,
      viewsByOthers: r.views_others,
      uniqueViewers: r.unique_viewers,
      presentations: r.presentations,
      lastViewedAt: r.last_viewed ? iso(r.last_viewed) : null,
      people: r.people,
    })),
  };
}
