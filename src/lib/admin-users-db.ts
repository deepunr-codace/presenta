import { ensureAiTables } from "@/lib/ai/pool-db";
import { sql } from "@/lib/auth/db";
import { ensureCollabTables } from "@/lib/collab-db";
import { ensureDeckTables } from "@/lib/decks-db";
import { ensureDriveTables } from "@/lib/drive-db";
import { ensureMediaTable } from "@/lib/media-db";

/** Every account with what it has stored and how much it uses the app, for the admin's Users page. Server only. */

export type AdminUserRow = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  /** "password" for email sign-up, "google" (or another provider) when the account has no password. */
  signIn: "password" | "oauth";
  createdAt: string;
  /** The latest of: a deck saved, a file uploaded, an AI request, a deck viewed or presented. */
  lastActiveAt: string | null;
  decks: number;
  trashedDecks: number;
  slides: number;
  deckBytes: number;
  media: number;
  mediaBytes: number;
  aiToday: number;
  ai30d: number;
  aiTotal: number;
  /** Views of this person's decks by anyone, and how often they presented. */
  views: number;
  presentations: number;
  sharedDecks: number;
  teams: number;
};

export type AdminUserDeck = { id: string; title: string; slides: number; bytes: number; updatedAt: string; trashed: boolean; views: number };
export type AdminUserDetail = { decks: AdminUserDeck[]; aiDaily: { day: string; count: number }[] };

type Row = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  has_password: boolean;
  created_at: string;
  last_active: string | null;
  decks: number;
  trashed: number;
  slides: number;
  deck_bytes: string | number;
  media: number;
  media_bytes: string | number;
  ai_today: number;
  ai_30d: number;
  ai_total: number;
  views: number;
  presentations: number;
  shared: number;
  teams: number;
};

const iso = (v: string | null) => (v ? new Date(v).toISOString() : null);

async function ensureAll(): Promise<void> {
  await ensureDeckTables();
  await Promise.all([ensureAiTables(), ensureCollabTables(), ensureDriveTables(), ensureMediaTable()]);
}

export async function listUsersWithUsage(): Promise<AdminUserRow[]> {
  await ensureAll();
  const rows = (await sql()`
    WITH d AS (
      SELECT user_id,
        COUNT(*) FILTER (WHERE trashed_at IS NULL)::int AS decks,
        COUNT(*) FILTER (WHERE trashed_at IS NOT NULL)::int AS trashed,
        COALESCE(SUM(slide_count) FILTER (WHERE trashed_at IS NULL), 0)::int AS slides,
        COALESCE(SUM(size_bytes), 0)::bigint AS deck_bytes,
        MAX(updated_at) AS last_deck
      FROM decks GROUP BY user_id
    ),
    m AS (SELECT user_id, COUNT(*)::int AS media, COALESCE(SUM(bytes), 0)::bigint AS media_bytes, MAX(created_at) AS last_media FROM media GROUP BY user_id),
    a AS (
      SELECT user_id,
        COALESCE(SUM(count) FILTER (WHERE day = CURRENT_DATE), 0)::int AS ai_today,
        COALESCE(SUM(count) FILTER (WHERE day > CURRENT_DATE - 30), 0)::int AS ai_30d,
        COALESCE(SUM(count), 0)::int AS ai_total,
        MAX(day) FILTER (WHERE count > 0) AS last_ai
      FROM ai_usage GROUP BY user_id
    ),
    e AS (
      SELECT owner_id AS user_id,
        COUNT(*) FILTER (WHERE kind = 'view')::int AS views,
        COUNT(*) FILTER (WHERE kind = 'present' AND user_id = owner_id)::int AS presentations
      FROM deck_events GROUP BY owner_id
    ),
    seen AS (SELECT user_id, MAX(at) AS last_event FROM deck_events GROUP BY user_id),
    s AS (SELECT owner_id AS user_id, COUNT(DISTINCT deck_id)::int AS shared FROM deck_shares GROUP BY owner_id),
    t AS (SELECT user_id, COUNT(*)::int AS teams FROM team_members GROUP BY user_id)
    SELECT u.id, u.name, u.email, u.image, (u.password_hash IS NOT NULL) AS has_password, u.created_at,
      GREATEST(d.last_deck, m.last_media, a.last_ai::timestamptz, seen.last_event) AS last_active,
      COALESCE(d.decks, 0) AS decks, COALESCE(d.trashed, 0) AS trashed, COALESCE(d.slides, 0) AS slides, COALESCE(d.deck_bytes, 0) AS deck_bytes,
      COALESCE(m.media, 0) AS media, COALESCE(m.media_bytes, 0) AS media_bytes,
      COALESCE(a.ai_today, 0) AS ai_today, COALESCE(a.ai_30d, 0) AS ai_30d, COALESCE(a.ai_total, 0) AS ai_total,
      COALESCE(e.views, 0) AS views, COALESCE(e.presentations, 0) AS presentations,
      COALESCE(s.shared, 0) AS shared, COALESCE(t.teams, 0) AS teams
    FROM users u
    LEFT JOIN d ON d.user_id = u.id
    LEFT JOIN m ON m.user_id = u.id
    LEFT JOIN a ON a.user_id = u.id
    LEFT JOIN e ON e.user_id = u.id
    LEFT JOIN seen ON seen.user_id = u.id
    LEFT JOIN s ON s.user_id = u.id
    LEFT JOIN t ON t.user_id = u.id
    ORDER BY u.created_at DESC
  `) as Row[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    image: r.image,
    signIn: r.has_password ? "password" : "oauth",
    createdAt: new Date(r.created_at).toISOString(),
    lastActiveAt: iso(r.last_active),
    decks: r.decks,
    trashedDecks: r.trashed,
    slides: r.slides,
    deckBytes: Number(r.deck_bytes),
    media: r.media,
    mediaBytes: Number(r.media_bytes),
    aiToday: r.ai_today,
    ai30d: r.ai_30d,
    aiTotal: r.ai_total,
    views: r.views,
    presentations: r.presentations,
    sharedDecks: r.shared,
    teams: r.teams,
  }));
}

/** One person's decks (with views) and their AI requests per day over the last 30 days. */
export async function userUsageDetail(userId: string): Promise<AdminUserDetail> {
  await ensureAll();
  const [decks, daily] = await Promise.all([
    sql()`
      SELECT d.id, d.title, d.slide_count, d.size_bytes, d.updated_at, (d.trashed_at IS NOT NULL) AS trashed,
        (SELECT COUNT(*)::int FROM deck_events e WHERE e.owner_id = d.user_id AND e.deck_id = d.id AND e.kind = 'view') AS views
      FROM decks d WHERE d.user_id = ${userId} ORDER BY d.updated_at DESC LIMIT 200
    ` as unknown as Promise<{ id: string; title: string; slide_count: number; size_bytes: number; updated_at: string; trashed: boolean; views: number }[]>,
    sql()`
      SELECT to_char(day, 'YYYY-MM-DD') AS day, count FROM ai_usage
      WHERE user_id = ${userId} AND day > CURRENT_DATE - 30 ORDER BY day ASC
    ` as unknown as Promise<{ day: string; count: number }[]>,
  ]);
  return {
    decks: decks.map((d) => ({ id: d.id, title: d.title, slides: d.slide_count, bytes: d.size_bytes, updatedAt: new Date(d.updated_at).toISOString(), trashed: d.trashed, views: d.views })),
    aiDaily: daily,
  };
}
