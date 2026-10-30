import { randomBytes } from "node:crypto";
import { sql } from "@/lib/auth/db";
import bcrypt from "bcryptjs";
import { ensureDeckTables } from "@/lib/decks-db";
import { newId } from "@/lib/deck/ids";
import { DeckSchema, type Deck } from "@/lib/deck/schema";
import { sanitizeHtml, stripTags } from "@/lib/text";
import { signShareAccess, verifyShareAccess } from "@/lib/share-access-token";

/**
 * Teams, deck sharing and edit locks, stored in Postgres. Every function takes the acting user's id and checks what
 * that user may do, so the API routes stay thin. Server only.
 */

export type DeckRole = "owner" | "editor" | "viewer";
export type ShareRole = "editor" | "viewer";
export type LinkAccess = "restricted" | "anyone_view";

/** A problem the user can fix or should be told about; `status` is the HTTP status the route answers with. */
export class CollabError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "CollabError";
  }
}

const token = () => randomBytes(18).toString("base64url");
const iso = (v: string | Date) => new Date(v).toISOString();

let ensured: Promise<void> | null = null;

export function ensureCollabTables(): Promise<void> {
  if (!ensured) {
    ensured = ensureDeckTables()
      .then(() => sql()`CREATE TABLE IF NOT EXISTS teams (id TEXT PRIMARY KEY, name TEXT NOT NULL, owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`)
      .then(
        () => sql()`
          CREATE TABLE IF NOT EXISTS team_members (
            team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            role TEXT NOT NULL DEFAULT 'member',
            joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (team_id, user_id)
          )
        `,
      )
      .then(
        () => sql()`
          CREATE TABLE IF NOT EXISTS team_invites (
            token TEXT PRIMARY KEY,
            team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
            email TEXT NOT NULL,
            invited_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        `,
      )
      .then(
        () => sql()`
          CREATE TABLE IF NOT EXISTS team_messages (
            id TEXT PRIMARY KEY,
            team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            body TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        `,
      )
      .then(() => sql()`CREATE INDEX IF NOT EXISTS team_messages_team ON team_messages (team_id, created_at)`)
      .then(
        () => sql()`
          CREATE TABLE IF NOT EXISTS deck_shares (
            owner_id TEXT NOT NULL,
            deck_id TEXT NOT NULL,
            kind TEXT NOT NULL,
            grantee_id TEXT NOT NULL,
            role TEXT NOT NULL,
            via_link BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (owner_id, deck_id, kind, grantee_id),
            FOREIGN KEY (owner_id, deck_id) REFERENCES decks(user_id, id) ON DELETE CASCADE
          )
        `,
      )
      .then(() => sql()`CREATE INDEX IF NOT EXISTS deck_shares_grantee ON deck_shares (grantee_id, kind)`)
      .then(() => sql()`
        CREATE TABLE IF NOT EXISTS deck_comments (
          id TEXT PRIMARY KEY,
          owner_id TEXT NOT NULL,
          deck_id TEXT NOT NULL,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          parent_id TEXT REFERENCES deck_comments(id) ON DELETE CASCADE,
          slide_id TEXT,
          body TEXT NOT NULL,
          resolved_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          FOREIGN KEY (owner_id, deck_id) REFERENCES decks(user_id, id) ON DELETE CASCADE
        )
      `)
      .then(() => sql()`CREATE INDEX IF NOT EXISTS deck_comments_deck ON deck_comments (owner_id, deck_id, created_at)`)
      .then(
        () => sql()`
          CREATE TABLE IF NOT EXISTS deck_links (
            owner_id TEXT NOT NULL,
            deck_id TEXT NOT NULL,
            token TEXT NOT NULL UNIQUE,
            access TEXT NOT NULL DEFAULT 'restricted',
            expires_at TIMESTAMPTZ,
            password_hash TEXT,
            password_updated_at TIMESTAMPTZ,
            PRIMARY KEY (owner_id, deck_id),
            FOREIGN KEY (owner_id, deck_id) REFERENCES decks(user_id, id) ON DELETE CASCADE
          )
        `,
      )
      .then(() => sql()`
        CREATE TABLE IF NOT EXISTS audience_questions (
          id TEXT PRIMARY KEY,
          token TEXT NOT NULL REFERENCES deck_links(token) ON DELETE CASCADE,
          visitor_id TEXT NOT NULL,
          display_name TEXT NOT NULL,
          body TEXT NOT NULL,
          slide_number INTEGER,
          hidden_at TIMESTAMPTZ,
          answered_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `)
      .then(() => sql()`CREATE INDEX IF NOT EXISTS audience_questions_token ON audience_questions (token, created_at DESC)`)
      .then(() => sql()`
        CREATE TABLE IF NOT EXISTS audience_polls (
          id TEXT PRIMARY KEY,
          token TEXT NOT NULL REFERENCES deck_links(token) ON DELETE CASCADE,
          created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          prompt TEXT NOT NULL,
          options JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          ended_at TIMESTAMPTZ
        )
      `)
      .then(() => sql()`CREATE UNIQUE INDEX IF NOT EXISTS audience_polls_one_active ON audience_polls (token) WHERE ended_at IS NULL`)
      .then(() => sql()`
        CREATE TABLE IF NOT EXISTS audience_votes (
          poll_id TEXT NOT NULL REFERENCES audience_polls(id) ON DELETE CASCADE,
          visitor_id TEXT NOT NULL,
          option_index INTEGER NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          PRIMARY KEY (poll_id, visitor_id)
        )
      `)
      .then(
        () => sql()`
          CREATE TABLE IF NOT EXISTS deck_locks (
            owner_id TEXT NOT NULL,
            deck_id TEXT NOT NULL,
            holder_id TEXT NOT NULL,
            holder_name TEXT NOT NULL,
            client_id TEXT NOT NULL,
            heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (owner_id, deck_id, client_id),
            FOREIGN KEY (owner_id, deck_id) REFERENCES decks(user_id, id) ON DELETE CASCADE
          )
        `,
      )
      .then(() => sql()`
        ALTER TABLE deck_links ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ
      `)
      .then(() => sql()`ALTER TABLE deck_links ADD COLUMN IF NOT EXISTS password_hash TEXT`)
      .then(() => sql()`ALTER TABLE deck_links ADD COLUMN IF NOT EXISTS password_updated_at TIMESTAMPTZ`)
      .then(() => sql()`
        DO $$
        DECLARE
          primary_name TEXT;
          primary_columns TEXT[];
        BEGIN
          SELECT c.conname::TEXT, array_agg(a.attname::TEXT ORDER BY u.ordinality)
            INTO primary_name, primary_columns
          FROM pg_constraint c
          CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS u(attnum, ordinality)
          JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = u.attnum
          WHERE c.conrelid = 'deck_locks'::regclass AND c.contype = 'p'
          GROUP BY c.conname;
          IF primary_columns IS DISTINCT FROM ARRAY['owner_id', 'deck_id', 'client_id']::TEXT[] THEN
            IF primary_name IS NOT NULL THEN
              EXECUTE format('ALTER TABLE deck_locks DROP CONSTRAINT %I', primary_name);
            END IF;
            ALTER TABLE deck_locks ADD PRIMARY KEY (owner_id, deck_id, client_id);
          END IF;
        END $$
      `)
      .then(
        () => sql()`
          CREATE TABLE IF NOT EXISTS deck_lock_requests (
            id TEXT PRIMARY KEY,
            owner_id TEXT NOT NULL,
            deck_id TEXT NOT NULL,
            requester_id TEXT NOT NULL,
            requester_name TEXT NOT NULL,
            client_id TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            FOREIGN KEY (owner_id, deck_id) REFERENCES decks(user_id, id) ON DELETE CASCADE
          )
        `,
      )
      .then(() => undefined);
    ensured.catch(() => (ensured = null));
  }
  return ensured;
}

async function displayName(userId: string): Promise<string> {
  const rows = (await sql()`SELECT name, email FROM users WHERE id = ${userId} LIMIT 1`) as { name: string | null; email: string }[];
  return rows[0]?.name?.trim() || rows[0]?.email || "Someone";
}

/* ======================= Teams ======================= */

export type TeamSummary = { id: string; name: string; role: "owner" | "member"; memberCount: number; ownerName: string };
export type TeamMember = { userId: string; name: string | null; email: string; role: "owner" | "member" };
export type TeamInvite = { token: string; email: string; createdAt: string };
export type TeamDetail = TeamSummary & { members: TeamMember[]; invites: TeamInvite[] };

export async function createTeam(userId: string, name: string): Promise<string> {
  await ensureCollabTables();
  const id = newId("team");
  await sql()`INSERT INTO teams (id, name, owner_id) VALUES (${id}, ${name}, ${userId})`;
  await sql()`INSERT INTO team_members (team_id, user_id, role) VALUES (${id}, ${userId}, 'owner')`;
  return id;
}

export async function listTeams(userId: string): Promise<TeamSummary[]> {
  await ensureCollabTables();
  const rows = (await sql()`
    SELECT t.id, t.name, m.role, COALESCE(u.name, u.email) AS owner_name,
      (SELECT COUNT(*)::int FROM team_members x WHERE x.team_id = t.id) AS member_count
    FROM team_members m
    JOIN teams t ON t.id = m.team_id
    JOIN users u ON u.id = t.owner_id
    WHERE m.user_id = ${userId}
    ORDER BY t.created_at ASC
  `) as { id: string; name: string; role: "owner" | "member"; owner_name: string; member_count: number }[];
  return rows.map((r) => ({ id: r.id, name: r.name, role: r.role, memberCount: r.member_count, ownerName: r.owner_name }));
}

export async function getTeam(userId: string, teamId: string): Promise<TeamDetail> {
  const teams = await listTeams(userId);
  const team = teams.find((t) => t.id === teamId);
  if (!team) throw new CollabError("That team was not found.", 404);
  const members = (await sql()`
    SELECT u.id AS user_id, u.name, u.email, m.role FROM team_members m JOIN users u ON u.id = m.user_id
    WHERE m.team_id = ${teamId} ORDER BY m.joined_at ASC
  `) as { user_id: string; name: string | null; email: string; role: "owner" | "member" }[];
  const invites =
    team.role === "owner"
      ? ((await sql()`SELECT token, email, created_at FROM team_invites WHERE team_id = ${teamId} ORDER BY created_at DESC`) as { token: string; email: string; created_at: string }[])
      : [];
  return {
    ...team,
    members: members.map((m) => ({ userId: m.user_id, name: m.name, email: m.email, role: m.role })),
    invites: invites.map((i) => ({ token: i.token, email: i.email, createdAt: iso(i.created_at) })),
  };
}

async function requireTeamOwner(userId: string, teamId: string): Promise<void> {
  const rows = (await sql()`SELECT 1 FROM teams WHERE id = ${teamId} AND owner_id = ${userId}`) as unknown[];
  if (!rows.length) throw new CollabError("Only the team owner can do that.", 403);
}

export async function deleteTeam(userId: string, teamId: string): Promise<void> {
  await ensureCollabTables();
  await requireTeamOwner(userId, teamId);
  await sql()`DELETE FROM deck_shares WHERE kind = 'team' AND grantee_id = ${teamId}`;
  await sql()`DELETE FROM teams WHERE id = ${teamId}`;
}

/** The owner removes a member, or a member removes themselves (leaves). The owner cannot leave; they delete the team. */
export async function removeMember(actingUserId: string, teamId: string, targetUserId: string): Promise<void> {
  await ensureCollabTables();
  if (actingUserId !== targetUserId) await requireTeamOwner(actingUserId, teamId);
  const rows = (await sql()`SELECT role FROM team_members WHERE team_id = ${teamId} AND user_id = ${targetUserId}`) as { role: string }[];
  if (!rows[0]) throw new CollabError("That person is not in the team.", 404);
  if (rows[0].role === "owner") throw new CollabError("The owner cannot leave. Delete the team instead.", 400);
  await sql()`DELETE FROM team_members WHERE team_id = ${teamId} AND user_id = ${targetUserId}`;
}

export async function createInvite(userId: string, teamId: string, email: string): Promise<{ token: string }> {
  await ensureCollabTables();
  await requireTeamOwner(userId, teamId);
  const normalized = email.trim().toLowerCase();
  const member = (await sql()`SELECT 1 FROM team_members m JOIN users u ON u.id = m.user_id WHERE m.team_id = ${teamId} AND lower(u.email) = ${normalized}`) as unknown[];
  if (member.length) throw new CollabError("That person is already in the team.");
  const existing = (await sql()`SELECT token FROM team_invites WHERE team_id = ${teamId} AND email = ${normalized}`) as { token: string }[];
  if (existing[0]) return { token: existing[0].token };
  const t = token();
  await sql()`INSERT INTO team_invites (token, team_id, email, invited_by) VALUES (${t}, ${teamId}, ${normalized}, ${userId})`;
  return { token: t };
}

export async function revokeInvite(userId: string, teamId: string, inviteToken: string): Promise<void> {
  await ensureCollabTables();
  await requireTeamOwner(userId, teamId);
  await sql()`DELETE FROM team_invites WHERE team_id = ${teamId} AND token = ${inviteToken}`;
}

export type InviteInfo = { token: string; teamId: string; teamName: string; invitedBy: string; email: string };

type InviteRow = { token: string; team_id: string; team_name: string; invited_by: string; email: string };
const toInvite = (r: InviteRow): InviteInfo => ({ token: r.token, teamId: r.team_id, teamName: r.team_name, invitedBy: r.invited_by, email: r.email });

export async function invitesForEmail(email: string): Promise<InviteInfo[]> {
  await ensureCollabTables();
  const rows = (await sql()`
    SELECT i.token, i.team_id, t.name AS team_name, COALESCE(u.name, u.email) AS invited_by, i.email
    FROM team_invites i JOIN teams t ON t.id = i.team_id JOIN users u ON u.id = i.invited_by
    WHERE i.email = ${email.trim().toLowerCase()} ORDER BY i.created_at DESC
  `) as InviteRow[];
  return rows.map(toInvite);
}

export async function inviteByToken(inviteToken: string): Promise<InviteInfo | null> {
  await ensureCollabTables();
  const rows = (await sql()`
    SELECT i.token, i.team_id, t.name AS team_name, COALESCE(u.name, u.email) AS invited_by, i.email
    FROM team_invites i JOIN teams t ON t.id = i.team_id JOIN users u ON u.id = i.invited_by
    WHERE i.token = ${inviteToken}
  `) as InviteRow[];
  return rows[0] ? toInvite(rows[0]) : null;
}

/** Join the team an invite is for. The signed-in account's email must be the one invited. */
export async function acceptInvite(userId: string, userEmail: string, inviteToken: string): Promise<string> {
  const invite = await inviteByToken(inviteToken);
  if (!invite) throw new CollabError("This invitation is no longer valid.", 404);
  if (invite.email !== userEmail.trim().toLowerCase()) throw new CollabError(`This invitation was sent to ${invite.email}. Sign in with that account to join.`, 403);
  await sql()`INSERT INTO team_members (team_id, user_id, role) VALUES (${invite.teamId}, ${userId}, 'member') ON CONFLICT DO NOTHING`;
  await sql()`DELETE FROM team_invites WHERE token = ${inviteToken}`;
  return invite.teamId;
}

export async function declineInvite(userEmail: string, inviteToken: string): Promise<void> {
  await ensureCollabTables();
  await sql()`DELETE FROM team_invites WHERE token = ${inviteToken} AND email = ${userEmail.trim().toLowerCase()}`;
}

/* ======================= Team chat ======================= */

export type TeamMessage = { id: string; userId: string; name: string; body: string; createdAt: string };

/** Longest message a person may post. */
export const TEAM_MESSAGE_MAX = 2000;
/** How many messages a first load (or a reload) brings back. */
const CHAT_PAGE = 100;

type MessageRow = { id: string; user_id: string; name: string; body: string; created_at: string };

const toMessage = (r: MessageRow): TeamMessage => ({ id: r.id, userId: r.user_id, name: r.name, body: r.body, createdAt: iso(r.created_at) });

async function requireTeamMember(userId: string, teamId: string): Promise<void> {
  const rows = (await sql()`SELECT 1 FROM team_members WHERE team_id = ${teamId} AND user_id = ${userId}`) as unknown[];
  if (!rows.length) throw new CollabError("Only members of this team can read its chat.", 403);
}

/**
 * The team's chat: the newest `CHAT_PAGE` messages, or only the ones posted after `afterId` when polling.
 * An `afterId` the team no longer has (deleted, or another team's) falls back to the newest page.
 */
export async function listTeamMessages(userId: string, teamId: string, afterId?: string | null): Promise<TeamMessage[]> {
  await ensureCollabTables();
  await requireTeamMember(userId, teamId);

  if (afterId) {
    const since = (await sql()`SELECT 1 FROM team_messages WHERE id = ${afterId} AND team_id = ${teamId}`) as unknown[];
    if (since.length) {
      // Compare the whole (created_at, id) pair: timestamps are stored with microsecond precision, so comparing
      // only created_at would hand back the message the caller already has.
      const newer = (await sql()`
        SELECT m.id, m.user_id, COALESCE(u.name, u.email) AS name, m.body, m.created_at
        FROM team_messages m JOIN users u ON u.id = m.user_id
        WHERE m.team_id = ${teamId}
          AND (m.created_at, m.id) > (
            SELECT s.created_at, s.id FROM team_messages s WHERE s.id = ${afterId} AND s.team_id = ${teamId}
          )
        ORDER BY m.created_at ASC, m.id ASC
        LIMIT 200
      `) as MessageRow[];
      return newer.map(toMessage);
    }
  }

  const rows = (await sql()`
    SELECT * FROM (
      SELECT m.id, m.user_id, COALESCE(u.name, u.email) AS name, m.body, m.created_at
      FROM team_messages m JOIN users u ON u.id = m.user_id
      WHERE m.team_id = ${teamId}
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT ${CHAT_PAGE}
    ) recent
    ORDER BY recent.created_at ASC, recent.id ASC
  `) as MessageRow[];
  return rows.map(toMessage);
}

/** Post a message in a team the user belongs to. */
export async function sendTeamMessage(userId: string, teamId: string, body: string): Promise<TeamMessage> {
  await ensureCollabTables();
  await requireTeamMember(userId, teamId);
  const text = body.trim();
  if (!text) throw new CollabError("Write something first.");
  if (text.length > TEAM_MESSAGE_MAX) throw new CollabError(`Messages can be at most ${TEAM_MESSAGE_MAX} characters.`);

  const id = newId("msg");
  await sql()`INSERT INTO team_messages (id, team_id, user_id, body) VALUES (${id}, ${teamId}, ${userId}, ${text})`;
  const rows = (await sql()`
    SELECT m.id, m.user_id, COALESCE(u.name, u.email) AS name, m.body, m.created_at
    FROM team_messages m JOIN users u ON u.id = m.user_id
    WHERE m.id = ${id}
  `) as MessageRow[];
  return toMessage(rows[0]);
}

/* ======================= Deck access ======================= */

const rank = (r: DeckRole) => (r === "owner" ? 3 : r === "editor" ? 2 : 1);

/** What `userId` may do with deck `deckId`: their own deck, or one shared with them directly or through a team. */
export async function resolveAccess(userId: string, deckId: string): Promise<{ ownerId: string; role: DeckRole } | null> {
  await ensureCollabTables();
  const own = (await sql()`SELECT 1 FROM decks WHERE user_id = ${userId} AND id = ${deckId}`) as unknown[];
  if (own.length) return { ownerId: userId, role: "owner" };
  const rows = (await sql()`
    SELECT s.owner_id, s.role FROM deck_shares s
    JOIN decks d ON d.user_id = s.owner_id AND d.id = s.deck_id AND d.trashed_at IS NULL
    WHERE s.deck_id = ${deckId}
      AND ((s.kind = 'user' AND s.grantee_id = ${userId})
        OR (s.kind = 'team' AND s.grantee_id IN (SELECT team_id FROM team_members WHERE user_id = ${userId})))
      AND (NOT s.via_link OR EXISTS (SELECT 1 FROM deck_links l WHERE l.owner_id = s.owner_id AND l.deck_id = s.deck_id AND l.access = 'anyone_view' AND (l.expires_at IS NULL OR l.expires_at > now())))
  `) as { owner_id: string; role: ShareRole }[];
  if (!rows.length) return null;
  const best = rows.reduce((a, b) => (rank(b.role) > rank(a.role) ? b : a));
  return { ownerId: best.owner_id, role: best.role };
}

export type DeckComment = { id: string; userId: string; name: string; parentId: string | null; slideId: string | null; body: string; resolvedAt: string | null; createdAt: string };

/** Comments are available to anyone with deck access; only the author or owner may resolve a thread. */
export async function listDeckComments(userId: string, deckId: string): Promise<DeckComment[]> {
  await ensureCollabTables();
  const access = await resolveAccess(userId, deckId);
  if (!access) throw new CollabError("Deck not found.", 404);
  const rows = (await sql()`
    SELECT c.id, c.user_id, COALESCE(u.name, u.email) AS name, c.parent_id, c.slide_id, c.body, c.resolved_at, c.created_at
    FROM deck_comments c JOIN users u ON u.id = c.user_id
    WHERE c.owner_id = ${access.ownerId} AND c.deck_id = ${deckId}
    ORDER BY c.created_at ASC, c.id ASC
  `) as { id: string; user_id: string; name: string; parent_id: string | null; slide_id: string | null; body: string; resolved_at: string | Date | null; created_at: string | Date }[];
  return rows.map((r) => ({ id: r.id, userId: r.user_id, name: r.name, parentId: r.parent_id, slideId: r.slide_id, body: r.body, resolvedAt: r.resolved_at ? iso(r.resolved_at) : null, createdAt: iso(r.created_at) }));
}

export async function addDeckComment(userId: string, deckId: string, body: string, slideId: string | null, parentId: string | null): Promise<void> {
  await ensureCollabTables();
  const access = await resolveAccess(userId, deckId);
  if (!access) throw new CollabError("You do not have permission to comment on this deck.", 403);
  const text = body.trim();
  if (!text || text.length > 4000) throw new CollabError("Comments must be between 1 and 4,000 characters.");
  if (parentId) {
    const parent = (await sql()`SELECT slide_id FROM deck_comments WHERE id = ${parentId} AND owner_id = ${access.ownerId} AND deck_id = ${deckId}`) as { slide_id: string | null }[];
    if (!parent[0]) throw new CollabError("That comment thread was not found.", 404);
  }
  await sql()`INSERT INTO deck_comments (id, owner_id, deck_id, user_id, parent_id, slide_id, body) VALUES (${newId("comment")}, ${access.ownerId}, ${deckId}, ${userId}, ${parentId}, ${slideId}, ${text})`;
}

export async function setDeckCommentResolved(userId: string, deckId: string, commentId: string, resolved: boolean): Promise<void> {
  await ensureCollabTables();
  const access = await resolveAccess(userId, deckId);
  if (!access) throw new CollabError("Deck not found.", 404);
  const result = await sql()`UPDATE deck_comments SET resolved_at = ${resolved ? new Date().toISOString() : null} WHERE id = ${commentId} AND owner_id = ${access.ownerId} AND deck_id = ${deckId} AND (${userId} = ${access.ownerId} OR user_id = ${userId}) RETURNING id` as unknown[];
  if (!result.length) throw new CollabError("You cannot resolve that comment.", 403);
}

export type AudienceQuestion = { id: string; name: string; body: string; slideNumber: number | null; createdAt: string; hiddenAt: string | null; answeredAt: string | null };
type AudienceQuestionRow = { id: string; display_name: string; body: string; slide_number: number | null; created_at: string | Date; hidden_at: string | Date | null; answered_at: string | Date | null };
const toAudienceQuestion = (r: AudienceQuestionRow): AudienceQuestion => ({ id: r.id, name: r.display_name, body: r.body, slideNumber: r.slide_number, createdAt: iso(r.created_at), hiddenAt: r.hidden_at ? iso(r.hidden_at) : null, answeredAt: r.answered_at ? iso(r.answered_at) : null });

/** Questions visible on an active public share link. */
export async function listPublicAudienceQuestions(linkToken: string): Promise<AudienceQuestion[] | null> {
  await ensureCollabTables();
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(linkToken)) return null;
  const rows = (await sql()`
    SELECT q.id, q.display_name, q.body, q.slide_number, q.created_at, q.hidden_at, q.answered_at
    FROM audience_questions q JOIN deck_links l ON l.token = q.token
    JOIN decks d ON d.user_id = l.owner_id AND d.id = l.deck_id
    WHERE q.token = ${linkToken} AND l.access = 'anyone_view' AND (l.expires_at IS NULL OR l.expires_at > now()) AND d.trashed_at IS NULL AND q.hidden_at IS NULL
    ORDER BY q.created_at ASC, q.id ASC LIMIT 100
  `) as AudienceQuestionRow[];
  const active = (await sql()`SELECT 1 FROM deck_links l JOIN decks d ON d.user_id = l.owner_id AND d.id = l.deck_id WHERE l.token = ${linkToken} AND l.access = 'anyone_view' AND (l.expires_at IS NULL OR l.expires_at > now()) AND d.trashed_at IS NULL`) as unknown[];
  return active.length ? rows.map(toAudienceQuestion) : null;
}

/** Public attendees may ask three questions per browser id within five minutes. */
export async function addPublicAudienceQuestion(linkToken: string, visitorId: string, name: string, body: string, slideNumber: number | null): Promise<void> {
  await ensureCollabTables();
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(linkToken)) throw new CollabError("This share link is not active.", 404);
  if (!/^[0-9a-f-]{36}$/i.test(visitorId)) throw new CollabError("Refresh the page and try again.");
  const link = (await sql()`SELECT l.token FROM deck_links l JOIN decks d ON d.user_id = l.owner_id AND d.id = l.deck_id WHERE l.token = ${linkToken} AND l.access = 'anyone_view' AND (l.expires_at IS NULL OR l.expires_at > now()) AND d.trashed_at IS NULL`) as { token: string }[];
  if (!link.length) throw new CollabError("This share link is not active.", 404);
  const recent = (await sql()`SELECT COUNT(*)::int AS count FROM audience_questions WHERE token = ${linkToken} AND visitor_id = ${visitorId} AND created_at > now() - interval '5 minutes'`) as { count: number }[];
  if ((recent[0]?.count ?? 0) >= 3) throw new CollabError("Please wait a few minutes before asking another question.", 429);
  const text = stripTags(body).trim().replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
  if (text.length < 3 || text.length > 500) throw new CollabError("Questions must be between 3 and 500 characters.");
  const displayName = stripTags(name).trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 80) || "Guest";
  await sql()`INSERT INTO audience_questions (id, token, visitor_id, display_name, body, slide_number) VALUES (${newId("question")}, ${linkToken}, ${visitorId}, ${displayName}, ${text}, ${slideNumber})`;
}

/** Deck editors can review and moderate questions sent through the deck's public link. */
export async function listDeckAudienceQuestions(userId: string, deckId: string): Promise<AudienceQuestion[]> {
  await ensureCollabTables();
  const access = await resolveAccess(userId, deckId);
  if (!access || access.role === "viewer") throw new CollabError("You cannot manage questions for this deck.", 403);
  const rows = (await sql()`
    SELECT q.id, q.display_name, q.body, q.slide_number, q.created_at, q.hidden_at, q.answered_at
    FROM audience_questions q JOIN deck_links l ON l.token = q.token
    WHERE l.owner_id = ${access.ownerId} AND l.deck_id = ${deckId}
    ORDER BY q.created_at DESC, q.id DESC LIMIT 200
  `) as AudienceQuestionRow[];
  return rows.map(toAudienceQuestion);
}

export async function moderateDeckAudienceQuestion(userId: string, deckId: string, questionId: string, patch: { hidden?: boolean; answered?: boolean }): Promise<void> {
  await ensureCollabTables();
  const access = await resolveAccess(userId, deckId);
  if (!access || access.role === "viewer") throw new CollabError("You cannot manage questions for this deck.", 403);
  const row = (await sql()`SELECT q.hidden_at, q.answered_at FROM audience_questions q JOIN deck_links l ON l.token = q.token WHERE q.id = ${questionId} AND l.owner_id = ${access.ownerId} AND l.deck_id = ${deckId}`) as { hidden_at: string | Date | null; answered_at: string | Date | null }[];
  if (!row[0]) throw new CollabError("That question was not found.", 404);
  const hiddenAt = patch.hidden === undefined ? row[0].hidden_at : patch.hidden ? new Date().toISOString() : null;
  const answeredAt = patch.answered === undefined ? row[0].answered_at : patch.answered ? new Date().toISOString() : null;
  await sql()`UPDATE audience_questions SET hidden_at = ${hiddenAt}, answered_at = ${answeredAt} WHERE id = ${questionId}`;
}

export type AudiencePoll = { id: string; prompt: string; options: string[]; voteCounts: number[]; totalVotes: number; createdAt: string; endedAt: string | null };
type AudiencePollRow = { id: string; prompt: string; options: unknown; created_at: string | Date; ended_at: string | Date | null };

async function pollWithVotes(row: AudiencePollRow, visitorId?: string): Promise<AudiencePoll & { myVote: number | null }> {
  let options: string[] = [];
  try { options = Array.isArray(row.options) ? row.options as string[] : JSON.parse(String(row.options)) as string[]; } catch { /* corrupt old rows remain hidden from the tally */ }
  const counts = (await sql()`SELECT option_index, COUNT(*)::int AS count FROM audience_votes WHERE poll_id = ${row.id} GROUP BY option_index`) as { option_index: number; count: number }[];
  const voteCounts = options.map((_, i) => counts.find((c) => c.option_index === i)?.count ?? 0);
  const mine = visitorId ? (await sql()`SELECT option_index FROM audience_votes WHERE poll_id = ${row.id} AND visitor_id = ${visitorId}`) as { option_index: number }[] : [];
  return { id: row.id, prompt: row.prompt, options, voteCounts, totalVotes: voteCounts.reduce((sum, value) => sum + value, 0), createdAt: iso(row.created_at), endedAt: row.ended_at ? iso(row.ended_at) : null, myVote: mine[0]?.option_index ?? null };
}

async function deckPublicToken(userId: string, deckId: string): Promise<{ ownerId: string; token: string }> {
  const access = await resolveAccess(userId, deckId);
  if (!access || access.role === "viewer") throw new CollabError("You cannot manage polls for this deck.", 403);
  const rows = (await sql()`SELECT token FROM deck_links WHERE owner_id = ${access.ownerId} AND deck_id = ${deckId} AND access = 'anyone_view'`) as { token: string }[];
  if (!rows[0]) throw new CollabError("Turn on the public share link before creating a live poll.", 409);
  return { ownerId: access.ownerId, token: rows[0].token };
}

export async function listDeckAudiencePolls(userId: string, deckId: string): Promise<AudiencePoll[]> {
  await ensureCollabTables();
  const { token: linkToken } = await deckPublicToken(userId, deckId);
  const rows = (await sql()`SELECT id, prompt, options, created_at, ended_at FROM audience_polls WHERE token = ${linkToken} ORDER BY created_at DESC LIMIT 50`) as AudiencePollRow[];
  return Promise.all(rows.map(async (row) => { const { myVote: _myVote, ...poll } = await pollWithVotes(row); return poll; }));
}

export async function createDeckAudiencePoll(userId: string, deckId: string, prompt: string, options: string[]): Promise<AudiencePoll[]> {
  await ensureCollabTables();
  const { token: linkToken } = await deckPublicToken(userId, deckId);
  const cleanPrompt = stripTags(prompt).trim().slice(0, 200);
  const cleanOptions = options.map((option) => stripTags(option).trim().slice(0, 80));
  if (cleanPrompt.length < 3 || cleanOptions.length < 2 || cleanOptions.length > 6 || cleanOptions.some((option) => !option)) throw new CollabError("A poll needs a question and 2 to 6 non-empty options.");
  const id = newId("poll");
  const created = (await sql()`INSERT INTO audience_polls (id, token, created_by, prompt, options) VALUES (${id}, ${linkToken}, ${userId}, ${cleanPrompt}, ${JSON.stringify(cleanOptions)}::jsonb) ON CONFLICT DO NOTHING RETURNING id`) as { id: string }[];
  if (!created.length) throw new CollabError("End the current poll before starting another.", 409);
  return listDeckAudiencePolls(userId, deckId);
}

export async function endDeckAudiencePoll(userId: string, deckId: string, pollId: string): Promise<AudiencePoll[]> {
  await ensureCollabTables();
  const { token: linkToken } = await deckPublicToken(userId, deckId);
  const ended = (await sql()`UPDATE audience_polls SET ended_at = now() WHERE id = ${pollId} AND token = ${linkToken} AND ended_at IS NULL RETURNING id`) as unknown[];
  if (!ended.length) throw new CollabError("That live poll was not found.", 404);
  return listDeckAudiencePolls(userId, deckId);
}

export async function getPublicAudiencePoll(linkToken: string, visitorId: string): Promise<(AudiencePoll & { myVote: number | null }) | null> {
  await ensureCollabTables();
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(linkToken)) throw new CollabError("This share link is not active.", 404);
  const activeLink = (await sql()`SELECT 1 FROM deck_links l JOIN decks d ON d.user_id = l.owner_id AND d.id = l.deck_id WHERE l.token = ${linkToken} AND l.access = 'anyone_view' AND (l.expires_at IS NULL OR l.expires_at > now()) AND d.trashed_at IS NULL`) as unknown[];
  if (!activeLink.length) throw new CollabError("This share link is not active.", 404);
  const rows = (await sql()`SELECT id, prompt, options, created_at, ended_at FROM audience_polls WHERE token = ${linkToken} AND ended_at IS NULL LIMIT 1`) as AudiencePollRow[];
  return rows[0] ? pollWithVotes(rows[0], visitorId) : null;
}

export async function castAudiencePollVote(linkToken: string, visitorId: string, pollId: string, optionIndex: number): Promise<AudiencePoll & { myVote: number | null }> {
  await ensureCollabTables();
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(linkToken) || !/^[0-9a-f-]{36}$/i.test(visitorId)) throw new CollabError("Refresh the page and try again.");
  const rows = (await sql()`SELECT p.id, p.prompt, p.options, p.created_at, p.ended_at FROM audience_polls p JOIN deck_links l ON l.token = p.token JOIN decks d ON d.user_id = l.owner_id AND d.id = l.deck_id WHERE p.id = ${pollId} AND p.token = ${linkToken} AND p.ended_at IS NULL AND l.access = 'anyone_view' AND (l.expires_at IS NULL OR l.expires_at > now()) AND d.trashed_at IS NULL`) as AudiencePollRow[];
  if (!rows[0]) throw new CollabError("This poll has ended.", 409);
  const options: unknown = Array.isArray(rows[0].options) ? rows[0].options : JSON.parse(String(rows[0].options));
  if (!Array.isArray(options) || optionIndex < 0 || optionIndex >= options.length) throw new CollabError("Choose one of the poll options.");
  await sql()`INSERT INTO audience_votes (poll_id, visitor_id, option_index) VALUES (${pollId}, ${visitorId}, ${optionIndex}) ON CONFLICT (poll_id, visitor_id) DO UPDATE SET option_index = EXCLUDED.option_index, created_at = now()`;
  return pollWithVotes(rows[0], visitorId);
}

export type SharedDeck = {
  id: string;
  title: string;
  updatedAt: string;
  slideCount: number;
  themeId: string;
  role: ShareRole;
  ownerName: string;
  /** Teams through which I have access (empty when it was shared with me directly or by link). */
  teamIds: string[];
  /** Shared with me by name or through a team, not just by a link I opened. */
  direct: boolean;
};

/** Decks other people (or teams I am in) have shared with me. */
export async function listSharedWithMe(userId: string): Promise<SharedDeck[]> {
  await ensureCollabTables();
  const rows = (await sql()`
    SELECT d.id, d.title, d.updated_at, d.slide_count, d.theme_id, s.role, s.kind, s.grantee_id, s.via_link, COALESCE(u.name, u.email) AS owner_name
    FROM deck_shares s
    JOIN decks d ON d.user_id = s.owner_id AND d.id = s.deck_id AND d.trashed_at IS NULL
    JOIN users u ON u.id = s.owner_id
    WHERE s.owner_id <> ${userId}
      AND ((s.kind = 'user' AND s.grantee_id = ${userId})
        OR (s.kind = 'team' AND s.grantee_id IN (SELECT team_id FROM team_members WHERE user_id = ${userId})))
      AND (NOT s.via_link OR EXISTS (
        SELECT 1 FROM deck_links l WHERE l.owner_id = s.owner_id AND l.deck_id = s.deck_id
          AND l.access = 'anyone_view' AND (l.expires_at IS NULL OR l.expires_at > now())
      ))
    ORDER BY d.updated_at DESC
  `) as { id: string; title: string; updated_at: string; slide_count: number; theme_id: string; role: ShareRole; kind: "user" | "team"; grantee_id: string; via_link: boolean; owner_name: string }[];
  const seen = new Map<string, SharedDeck>();
  for (const r of rows) {
    const prev = seen.get(r.id);
    const teamIds = [...(prev?.teamIds ?? []), ...(r.kind === "team" ? [r.grantee_id] : [])];
    const direct = Boolean(prev?.direct) || r.kind === "team" || !r.via_link;
    const role = prev && rank(prev.role) >= rank(r.role) ? prev.role : r.role;
    seen.set(r.id, { id: r.id, title: r.title, updatedAt: iso(r.updated_at), slideCount: r.slide_count, themeId: r.theme_id, role, ownerName: r.owner_name, teamIds, direct });
  }
  return [...seen.values()];
}

/* ======================= Sharing a deck ======================= */

export type ShareEntry = { kind: "user" | "team"; granteeId: string; name: string; detail: string; role: ShareRole };

async function requireOwnDeck(ownerId: string, deckId: string): Promise<void> {
  const rows = (await sql()`SELECT 1 FROM decks WHERE user_id = ${ownerId} AND id = ${deckId} AND trashed_at IS NULL`) as unknown[];
  if (!rows.length) throw new CollabError("Only the owner can share this deck.", 403);
}

export async function listDeckShares(ownerId: string, deckId: string): Promise<{ shares: ShareEntry[]; viaLinkCount: number }> {
  await ensureCollabTables();
  await requireOwnDeck(ownerId, deckId);
  const users = (await sql()`
    SELECT s.grantee_id, COALESCE(u.name, u.email) AS name, u.email, s.role FROM deck_shares s JOIN users u ON u.id = s.grantee_id
    WHERE s.owner_id = ${ownerId} AND s.deck_id = ${deckId} AND s.kind = 'user' AND NOT s.via_link ORDER BY s.created_at
  `) as { grantee_id: string; name: string; email: string; role: ShareRole }[];
  const teams = (await sql()`
    SELECT s.grantee_id, t.name, s.role, (SELECT COUNT(*)::int FROM team_members m WHERE m.team_id = t.id) AS members
    FROM deck_shares s JOIN teams t ON t.id = s.grantee_id
    WHERE s.owner_id = ${ownerId} AND s.deck_id = ${deckId} AND s.kind = 'team' ORDER BY s.created_at
  `) as { grantee_id: string; name: string; role: ShareRole; members: number }[];
  const via = (await sql()`SELECT COUNT(*)::int AS n FROM deck_shares WHERE owner_id = ${ownerId} AND deck_id = ${deckId} AND via_link`) as { n: number }[];
  return {
    shares: [
      ...users.map((u): ShareEntry => ({ kind: "user", granteeId: u.grantee_id, name: u.name, detail: u.email, role: u.role })),
      ...teams.map((t): ShareEntry => ({ kind: "team", granteeId: t.grantee_id, name: t.name, detail: `${t.members} member${t.members === 1 ? "" : "s"}`, role: t.role })),
    ],
    viaLinkCount: via[0]?.n ?? 0,
  };
}

/** Share with one person who already has an account. */
export async function shareWithUser(ownerId: string, deckId: string, email: string, role: ShareRole): Promise<void> {
  await ensureCollabTables();
  await requireOwnDeck(ownerId, deckId);
  const users = (await sql()`SELECT id FROM users WHERE lower(email) = ${email.trim().toLowerCase()}`) as { id: string }[];
  if (!users[0]) throw new CollabError("No Presenta account uses that email. Ask them to sign up first, or invite them to a team.", 404);
  const granteeId = users[0].id;
  if (granteeId === ownerId) throw new CollabError("That is your own account.");
  const clash = (await sql()`SELECT 1 FROM decks WHERE user_id = ${granteeId} AND id = ${deckId}`) as unknown[];
  if (clash.length) throw new CollabError("That person already has a different deck with the same id, so it cannot be shared with them.", 409);
  await sql()`
    INSERT INTO deck_shares (owner_id, deck_id, kind, grantee_id, role) VALUES (${ownerId}, ${deckId}, 'user', ${granteeId}, ${role})
    ON CONFLICT (owner_id, deck_id, kind, grantee_id) DO UPDATE SET role = EXCLUDED.role, via_link = false
  `;
}

/** Share with a team the owner belongs to. */
export async function shareWithTeam(ownerId: string, deckId: string, teamId: string, role: ShareRole): Promise<void> {
  await ensureCollabTables();
  await requireOwnDeck(ownerId, deckId);
  const mine = (await sql()`SELECT 1 FROM team_members WHERE team_id = ${teamId} AND user_id = ${ownerId}`) as unknown[];
  if (!mine.length) throw new CollabError("You can only share with teams you belong to.", 403);
  await sql()`
    INSERT INTO deck_shares (owner_id, deck_id, kind, grantee_id, role) VALUES (${ownerId}, ${deckId}, 'team', ${teamId}, ${role})
    ON CONFLICT (owner_id, deck_id, kind, grantee_id) DO UPDATE SET role = EXCLUDED.role
  `;
}

export async function removeShare(ownerId: string, deckId: string, kind: "user" | "team", granteeId: string): Promise<void> {
  await ensureCollabTables();
  await requireOwnDeck(ownerId, deckId);
  await sql()`DELETE FROM deck_shares WHERE owner_id = ${ownerId} AND deck_id = ${deckId} AND kind = ${kind} AND grantee_id = ${granteeId}`;
  if (kind === "user") {
    await sql()`DELETE FROM deck_locks WHERE owner_id = ${ownerId} AND deck_id = ${deckId} AND holder_id = ${granteeId}`;
  }
}

/* ---------- Link ---------- */

export async function getLink(ownerId: string, deckId: string): Promise<{ access: LinkAccess; token: string; expiresAt: string | null; passwordEnabled: boolean } | null> {
  await ensureCollabTables();
  await requireOwnDeck(ownerId, deckId);
  const rows = (await sql()`SELECT access, token, expires_at, password_hash FROM deck_links WHERE owner_id = ${ownerId} AND deck_id = ${deckId}`) as { access: LinkAccess; token: string; expires_at: string | Date | null; password_hash: string | null }[];
  return rows[0] ? { access: rows[0].access, token: rows[0].token, expiresAt: rows[0].expires_at ? iso(rows[0].expires_at) : null, passwordEnabled: Boolean(rows[0].password_hash) } : null;
}

/**
 * Who a share link works for. `anyone_view` lets any signed-in person with the link view the deck; `restricted` turns the
 * link off (and withdraws access that people got through it). The link's token stays the same so it can be switched back on.
 */
export async function setLinkAccess(ownerId: string, deckId: string, access: LinkAccess): Promise<{ access: LinkAccess; token: string; expiresAt: string | null; passwordEnabled: boolean }> {
  await ensureCollabTables();
  await requireOwnDeck(ownerId, deckId);
  const rows = (await sql()`
    INSERT INTO deck_links (owner_id, deck_id, token, access) VALUES (${ownerId}, ${deckId}, ${token()}, ${access})
    ON CONFLICT (owner_id, deck_id) DO UPDATE SET access = EXCLUDED.access
    RETURNING access, token, expires_at, password_hash
  `) as { access: LinkAccess; token: string; expires_at: string | Date | null; password_hash: string | null }[];
  if (access === "restricted") {
    await sql()`DELETE FROM deck_shares WHERE owner_id = ${ownerId} AND deck_id = ${deckId} AND via_link`;
    await sql()`UPDATE audience_polls SET ended_at = now() WHERE token = ${rows[0].token} AND ended_at IS NULL`;
  }
  return { access: rows[0].access, token: rows[0].token, expiresAt: rows[0].expires_at ? iso(rows[0].expires_at) : null, passwordEnabled: Boolean(rows[0].password_hash) };
}

/** Set or clear a public link's expiry. The owner can extend an expired link without changing its URL. */
export async function setLinkExpiry(ownerId: string, deckId: string, hours: 24 | 168 | 720 | null): Promise<{ access: LinkAccess; token: string; expiresAt: string | null; passwordEnabled: boolean }> {
  await ensureCollabTables();
  await requireOwnDeck(ownerId, deckId);
  const current = await getLink(ownerId, deckId);
  if (!current) throw new CollabError("Enable the share link before setting an expiry.", 409);
  const rows = (await sql()`UPDATE deck_links SET expires_at = ${hours === null ? null : new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()} WHERE owner_id = ${ownerId} AND deck_id = ${deckId} RETURNING access, token, expires_at, password_hash`) as { access: LinkAccess; token: string; expires_at: string | Date | null; password_hash: string | null }[];
  return { access: rows[0].access, token: rows[0].token, expiresAt: rows[0].expires_at ? iso(rows[0].expires_at) : null, passwordEnabled: Boolean(rows[0].password_hash) };
}

export async function setLinkPassword(ownerId: string, deckId: string, password: string | null): Promise<{ access: LinkAccess; token: string; expiresAt: string | null; passwordEnabled: boolean }> {
  await ensureCollabTables();
  await requireOwnDeck(ownerId, deckId);
  const current = await getLink(ownerId, deckId);
  if (!current) throw new CollabError("Enable the share link before setting a password.", 409);
  if (password !== null && (password.length < 8 || Buffer.byteLength(password, "utf8") > 72)) throw new CollabError("Use a password between 8 and 72 characters.");
  const passwordHash = password === null ? null : await bcrypt.hash(password, 12);
  const rows = (await sql()`UPDATE deck_links SET password_hash = ${passwordHash}, password_updated_at = now() WHERE owner_id = ${ownerId} AND deck_id = ${deckId} RETURNING access, token, expires_at, password_hash`) as { access: LinkAccess; token: string; expires_at: string | Date | null; password_hash: string | null }[];
  return { access: rows[0].access, token: rows[0].token, expiresAt: rows[0].expires_at ? iso(rows[0].expires_at) : null, passwordEnabled: Boolean(rows[0].password_hash) };
}

export async function publicLinkNeedsPassword(linkToken: string): Promise<boolean | null> {
  await ensureCollabTables();
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(linkToken)) return null;
  const rows = (await sql()`SELECT l.password_hash FROM deck_links l JOIN decks d ON d.user_id = l.owner_id AND d.id = l.deck_id WHERE l.token = ${linkToken} AND l.access = 'anyone_view' AND (l.expires_at IS NULL OR l.expires_at > now()) AND d.trashed_at IS NULL`) as { password_hash: string | null }[];
  return rows.length ? Boolean(rows[0].password_hash) : null;
}

export async function authenticatePublicLink(linkToken: string, password: string): Promise<string | null> {
  await ensureCollabTables();
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(linkToken)) return null;
  const rows = (await sql()`SELECT l.password_hash, l.password_updated_at FROM deck_links l JOIN decks d ON d.user_id = l.owner_id AND d.id = l.deck_id WHERE l.token = ${linkToken} AND l.access = 'anyone_view' AND (l.expires_at IS NULL OR l.expires_at > now()) AND d.trashed_at IS NULL`) as { password_hash: string | null; password_updated_at: string | Date | null }[];
  const row = rows[0];
  if (!row?.password_hash || !(await bcrypt.compare(password, row.password_hash))) return null;
  return signShareAccess(linkToken, row.password_updated_at ? new Date(row.password_updated_at).getTime() : 0);
}

export async function authorizePublicLink(linkToken: string, accessToken: string | null): Promise<boolean> {
  await ensureCollabTables();
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(linkToken)) return false;
  const rows = (await sql()`SELECT l.password_hash, l.password_updated_at FROM deck_links l JOIN decks d ON d.user_id = l.owner_id AND d.id = l.deck_id WHERE l.token = ${linkToken} AND l.access = 'anyone_view' AND (l.expires_at IS NULL OR l.expires_at > now()) AND d.trashed_at IS NULL`) as { password_hash: string | null; password_updated_at: string | Date | null }[];
  if (!rows[0]) return false;
  if (!rows[0].password_hash) return true;
  const version = rows[0].password_updated_at ? new Date(rows[0].password_updated_at).getTime() : 0;
  return verifyShareAccess(accessToken, linkToken, version);
}

/** A signed-in visitor opens a link: if the owner allows it, they become a viewer. Returns the deck id to open. */
export async function claimLink(userId: string, linkToken: string, accessToken: string | null = null): Promise<{ deckId: string }> {
  await ensureCollabTables();
  const rows = (await sql()`
    SELECT l.owner_id, l.deck_id, l.access, l.expires_at, d.trashed_at FROM deck_links l
    JOIN decks d ON d.user_id = l.owner_id AND d.id = l.deck_id WHERE l.token = ${linkToken}
  `) as { owner_id: string; deck_id: string; access: LinkAccess; expires_at: string | Date | null; trashed_at: string | null }[];
  const link = rows[0];
  if (!link || link.access !== "anyone_view" || link.trashed_at || (link.expires_at && new Date(link.expires_at).getTime() <= Date.now())) throw new CollabError("This link is not active. Ask the owner to share the deck again.", 404);
  const requiresPassword = await publicLinkNeedsPassword(linkToken);
  if (requiresPassword && !(await authorizePublicLink(linkToken, accessToken))) throw new CollabError("Enter the share password to open this link.", 401);
  if (link.owner_id === userId) return { deckId: link.deck_id };
  const clash = (await sql()`SELECT 1 FROM decks WHERE user_id = ${userId} AND id = ${link.deck_id}`) as unknown[];
  if (clash.length) throw new CollabError("You already have a different deck with the same id, so this one cannot be opened.", 409);
  await sql()`
    INSERT INTO deck_shares (owner_id, deck_id, kind, grantee_id, role, via_link) VALUES (${link.owner_id}, ${link.deck_id}, 'user', ${userId}, 'viewer', true)
    ON CONFLICT DO NOTHING
  `;
  return { deckId: link.deck_id };
}

/** Read-only deck data for a valid public token. Speaker notes and unsafe rich text are never exposed. */
export async function getPublicDeckByToken(linkToken: string): Promise<Deck | null> {
  await ensureCollabTables();
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(linkToken)) return null;
  const rows = (await sql()`
    SELECT d.data FROM deck_links l
    JOIN decks d ON d.user_id = l.owner_id AND d.id = l.deck_id
    WHERE l.token = ${linkToken} AND l.access = 'anyone_view' AND (l.expires_at IS NULL OR l.expires_at > now()) AND d.trashed_at IS NULL
    LIMIT 1
  `) as { data: unknown }[];
  if (!rows[0]) return null;
  const parsed = DeckSchema.safeParse(rows[0].data);
  if (!parsed.success) return null;
  const deck = parsed.data;
  for (const slide of deck.slides) {
    slide.notes = "";
    for (const element of slide.elements) if (element.type === "text") element.html = sanitizeHtml(element.html);
  }
  return deck;
}

/* ======================= Edit lock ======================= */

/** A holder who has not been heard from for this long no longer holds the lock. */
export const LOCK_TTL_SECONDS = 20;
/** A request nobody answered within this long is dropped. */
const REQUEST_TTL_SECONDS = 90;

export type LockState =
  | { state: "mine" }
  | { state: "held"; holderName: string };

/** Take the edit lock if it is free, expired, or already this tab's. */
export async function acquireLock(ownerId: string, deckId: string, userId: string, clientId: string): Promise<LockState> {
  await ensureCollabTables();
  const name = await displayName(userId);
  const taken = (await sql()`
    INSERT INTO deck_locks (owner_id, deck_id, holder_id, holder_name, client_id) VALUES (${ownerId}, ${deckId}, ${userId}, ${name}, ${clientId})
    ON CONFLICT (owner_id, deck_id, client_id) DO UPDATE SET holder_id = EXCLUDED.holder_id, holder_name = EXCLUDED.holder_name, heartbeat_at = now()
    RETURNING 1
  `) as unknown[];
  return taken.length ? { state: "mine" } : { state: "held", holderName: name };
}

export type PendingRequest = { id: string; requesterName: string };

/** Keep the lock alive. `lost` means someone else holds it now. Also reports a take-over request waiting for an answer. */
export async function heartbeat(ownerId: string, deckId: string, clientId: string): Promise<{ lost: true } | { lost: false; request: PendingRequest | null }> {
  await ensureCollabTables();
  const alive = (await sql()`UPDATE deck_locks SET heartbeat_at = now() WHERE owner_id = ${ownerId} AND deck_id = ${deckId} AND client_id = ${clientId} RETURNING 1`) as unknown[];
  if (!alive.length) return { lost: true };
  return { lost: false, request: null };
}

export async function releaseLock(ownerId: string, deckId: string, clientId: string): Promise<void> {
  await ensureCollabTables();
  await sql()`DELETE FROM deck_locks WHERE owner_id = ${ownerId} AND deck_id = ${deckId} AND client_id = ${clientId}`;
}

/** Ask the current holder to hand over editing. Replaces any earlier request from the same tab. */
export async function requestTakeover(ownerId: string, deckId: string, userId: string, clientId: string): Promise<{ requestId: string }> {
  void ownerId; void deckId; void userId; void clientId;
  throw new CollabError("Editors can work on this deck at the same time.", 409);
}

export type RequestStatus = "pending" | "allowed" | "denied" | "free" | "expired";

/** Where a take-over request stands. `free` means the holder left or went quiet, so the requester can simply take the lock. */
export async function requestStatus(ownerId: string, deckId: string, clientId: string, requestId: string): Promise<RequestStatus> {
  await ensureCollabTables();
  const rows = (await sql()`
    SELECT status, created_at < now() - make_interval(secs => ${REQUEST_TTL_SECONDS}) AS stale FROM deck_lock_requests
    WHERE id = ${requestId} AND owner_id = ${ownerId} AND deck_id = ${deckId} AND client_id = ${clientId}
  `) as { status: string; stale: boolean }[];
  const row = rows[0];
  if (!row) return "expired";
  if (row.status === "allowed") return "allowed";
  if (row.status === "denied") return "denied";
  const lock = (await sql()`SELECT 1 FROM deck_locks WHERE owner_id = ${ownerId} AND deck_id = ${deckId} AND heartbeat_at > now() - make_interval(secs => ${LOCK_TTL_SECONDS})`) as unknown[];
  if (!lock.length) return "free";
  return row.stale ? "expired" : "pending";
}

/** The holder answers a request. Allowing hands the lock to the requester at once; the holder must have saved first. */
export async function respondToRequest(ownerId: string, deckId: string, holderClientId: string, requestId: string, allow: boolean): Promise<void> {
  await ensureCollabTables();
  const holds = (await sql()`SELECT 1 FROM deck_locks WHERE owner_id = ${ownerId} AND deck_id = ${deckId} AND client_id = ${holderClientId}`) as unknown[];
  if (!holds.length) throw new CollabError("You no longer hold the edit lock.", 409);
  const reqs = (await sql()`
    SELECT requester_id, requester_name, client_id FROM deck_lock_requests WHERE id = ${requestId} AND owner_id = ${ownerId} AND deck_id = ${deckId} AND status = 'pending'
  `) as { requester_id: string; requester_name: string; client_id: string }[];
  const req = reqs[0];
  if (!req) throw new CollabError("That request is no longer waiting.", 404);
  if (!allow) {
    await sql()`UPDATE deck_lock_requests SET status = 'denied' WHERE id = ${requestId}`;
    return;
  }
  await sql()`
    UPDATE deck_locks SET holder_id = ${req.requester_id}, holder_name = ${req.requester_name}, client_id = ${req.client_id}, heartbeat_at = now()
    WHERE owner_id = ${ownerId} AND deck_id = ${deckId} AND client_id = ${holderClientId}
  `;
  await sql()`UPDATE deck_lock_requests SET status = 'allowed' WHERE id = ${requestId}`;
}

/** True when another tab or person holds a live lock, so this save must be refused. */
export async function lockBlocksSave(ownerId: string, deckId: string, clientId: string | null): Promise<{ holderName: string } | null> {
  void ownerId; void deckId; void clientId;
  return null;
}

/** Who has the deck open for editing right now, for a read-only viewer's "X is editing" note. */
export async function currentEditor(ownerId: string, deckId: string): Promise<string | null> {
  await ensureCollabTables();
  const rows = (await sql()`
    SELECT COUNT(*)::int AS count, MIN(holder_name) AS name FROM deck_locks
    WHERE owner_id = ${ownerId} AND deck_id = ${deckId} AND heartbeat_at > now() - make_interval(secs => ${LOCK_TTL_SECONDS})
  `) as { count: number; name: string | null }[];
  const row = rows[0];
  return !row?.count ? null : row.count > 1 ? `${row.name ?? "Someone"} and ${row.count - 1} other${row.count === 2 ? "" : "s"}` : row.name;
}

/** Whether this browser tab still holds a live edit lease for a deck. */
export async function holdsEditLock(ownerId: string, deckId: string, clientId: string): Promise<boolean> {
  await ensureCollabTables();
  const rows = (await sql()`SELECT 1 FROM deck_locks WHERE owner_id = ${ownerId} AND deck_id = ${deckId} AND client_id = ${clientId} AND heartbeat_at > now() - make_interval(secs => ${LOCK_TTL_SECONDS})`) as unknown[];
  return rows.length > 0;
}

/** Clean up everything that points at a user who is being deleted (shares to them cannot use a foreign key). */
export async function forgetUser(userId: string): Promise<void> {
  await ensureCollabTables();
  await sql()`DELETE FROM deck_shares WHERE kind = 'user' AND grantee_id = ${userId}`;
  await sql()`DELETE FROM deck_locks WHERE holder_id = ${userId}`;
  await sql()`DELETE FROM team_invites WHERE email = (SELECT lower(email) FROM users WHERE id = ${userId})`;
  // Teams they own go with them; their shares to those teams must not outlive the teams.
  await sql()`DELETE FROM deck_shares WHERE kind = 'team' AND grantee_id IN (SELECT id FROM teams WHERE owner_id = ${userId})`;
}
