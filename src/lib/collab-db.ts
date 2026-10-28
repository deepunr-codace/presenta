import { randomBytes } from "node:crypto";
import { sql } from "@/lib/auth/db";
import { ensureDeckTables } from "@/lib/decks-db";
import { newId } from "@/lib/deck/ids";

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
      .then(
        () => sql()`
          CREATE TABLE IF NOT EXISTS deck_links (
            owner_id TEXT NOT NULL,
            deck_id TEXT NOT NULL,
            token TEXT NOT NULL UNIQUE,
            access TEXT NOT NULL DEFAULT 'restricted',
            PRIMARY KEY (owner_id, deck_id),
            FOREIGN KEY (owner_id, deck_id) REFERENCES decks(user_id, id) ON DELETE CASCADE
          )
        `,
      )
      .then(
        () => sql()`
          CREATE TABLE IF NOT EXISTS deck_locks (
            owner_id TEXT NOT NULL,
            deck_id TEXT NOT NULL,
            holder_id TEXT NOT NULL,
            holder_name TEXT NOT NULL,
            client_id TEXT NOT NULL,
            heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (owner_id, deck_id),
            FOREIGN KEY (owner_id, deck_id) REFERENCES decks(user_id, id) ON DELETE CASCADE
          )
        `,
      )
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
  `) as { owner_id: string; role: ShareRole }[];
  if (!rows.length) return null;
  const best = rows.reduce((a, b) => (rank(b.role) > rank(a.role) ? b : a));
  return { ownerId: best.owner_id, role: best.role };
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

export async function getLink(ownerId: string, deckId: string): Promise<{ access: LinkAccess; token: string } | null> {
  await ensureCollabTables();
  await requireOwnDeck(ownerId, deckId);
  const rows = (await sql()`SELECT access, token FROM deck_links WHERE owner_id = ${ownerId} AND deck_id = ${deckId}`) as { access: LinkAccess; token: string }[];
  return rows[0] ?? null;
}

/**
 * Who a share link works for. `anyone_view` lets any signed-in person with the link view the deck; `restricted` turns the
 * link off (and withdraws access that people got through it). The link's token stays the same so it can be switched back on.
 */
export async function setLinkAccess(ownerId: string, deckId: string, access: LinkAccess): Promise<{ access: LinkAccess; token: string }> {
  await ensureCollabTables();
  await requireOwnDeck(ownerId, deckId);
  const rows = (await sql()`
    INSERT INTO deck_links (owner_id, deck_id, token, access) VALUES (${ownerId}, ${deckId}, ${token()}, ${access})
    ON CONFLICT (owner_id, deck_id) DO UPDATE SET access = EXCLUDED.access
    RETURNING access, token
  `) as { access: LinkAccess; token: string }[];
  if (access === "restricted") await sql()`DELETE FROM deck_shares WHERE owner_id = ${ownerId} AND deck_id = ${deckId} AND via_link`;
  return rows[0];
}

/** A signed-in visitor opens a link: if the owner allows it, they become a viewer. Returns the deck id to open. */
export async function claimLink(userId: string, linkToken: string): Promise<{ deckId: string }> {
  await ensureCollabTables();
  const rows = (await sql()`
    SELECT l.owner_id, l.deck_id, l.access, d.trashed_at FROM deck_links l
    JOIN decks d ON d.user_id = l.owner_id AND d.id = l.deck_id WHERE l.token = ${linkToken}
  `) as { owner_id: string; deck_id: string; access: LinkAccess; trashed_at: string | null }[];
  const link = rows[0];
  if (!link || link.access !== "anyone_view" || link.trashed_at) throw new CollabError("This link is not active. Ask the owner to share the deck again.", 404);
  if (link.owner_id === userId) return { deckId: link.deck_id };
  const clash = (await sql()`SELECT 1 FROM decks WHERE user_id = ${userId} AND id = ${link.deck_id}`) as unknown[];
  if (clash.length) throw new CollabError("You already have a different deck with the same id, so this one cannot be opened.", 409);
  await sql()`
    INSERT INTO deck_shares (owner_id, deck_id, kind, grantee_id, role, via_link) VALUES (${link.owner_id}, ${link.deck_id}, 'user', ${userId}, 'viewer', true)
    ON CONFLICT DO NOTHING
  `;
  return { deckId: link.deck_id };
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
    ON CONFLICT (owner_id, deck_id) DO UPDATE SET holder_id = EXCLUDED.holder_id, holder_name = EXCLUDED.holder_name, client_id = EXCLUDED.client_id, heartbeat_at = now()
    WHERE deck_locks.client_id = EXCLUDED.client_id OR deck_locks.heartbeat_at < now() - make_interval(secs => ${LOCK_TTL_SECONDS})
    RETURNING 1
  `) as unknown[];
  if (taken.length) return { state: "mine" };
  const holder = (await sql()`SELECT holder_name FROM deck_locks WHERE owner_id = ${ownerId} AND deck_id = ${deckId}`) as { holder_name: string }[];
  return { state: "held", holderName: holder[0]?.holder_name ?? "Someone" };
}

export type PendingRequest = { id: string; requesterName: string };

/** Keep the lock alive. `lost` means someone else holds it now. Also reports a take-over request waiting for an answer. */
export async function heartbeat(ownerId: string, deckId: string, clientId: string): Promise<{ lost: true } | { lost: false; request: PendingRequest | null }> {
  await ensureCollabTables();
  const alive = (await sql()`UPDATE deck_locks SET heartbeat_at = now() WHERE owner_id = ${ownerId} AND deck_id = ${deckId} AND client_id = ${clientId} RETURNING 1`) as unknown[];
  if (!alive.length) return { lost: true };
  const req = (await sql()`
    SELECT id, requester_name FROM deck_lock_requests
    WHERE owner_id = ${ownerId} AND deck_id = ${deckId} AND status = 'pending' AND created_at > now() - make_interval(secs => ${REQUEST_TTL_SECONDS})
    ORDER BY created_at ASC LIMIT 1
  `) as { id: string; requester_name: string }[];
  return { lost: false, request: req[0] ? { id: req[0].id, requesterName: req[0].requester_name } : null };
}

export async function releaseLock(ownerId: string, deckId: string, clientId: string): Promise<void> {
  await ensureCollabTables();
  await sql()`DELETE FROM deck_locks WHERE owner_id = ${ownerId} AND deck_id = ${deckId} AND client_id = ${clientId}`;
}

/** Ask the current holder to hand over editing. Replaces any earlier request from the same tab. */
export async function requestTakeover(ownerId: string, deckId: string, userId: string, clientId: string): Promise<{ requestId: string }> {
  await ensureCollabTables();
  const name = await displayName(userId);
  await sql()`DELETE FROM deck_lock_requests WHERE owner_id = ${ownerId} AND deck_id = ${deckId} AND client_id = ${clientId}`;
  const id = newId("lockreq");
  await sql()`INSERT INTO deck_lock_requests (id, owner_id, deck_id, requester_id, requester_name, client_id) VALUES (${id}, ${ownerId}, ${deckId}, ${userId}, ${name}, ${clientId})`;
  return { requestId: id };
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
  await ensureCollabTables();
  const rows = (await sql()`
    SELECT holder_name FROM deck_locks
    WHERE owner_id = ${ownerId} AND deck_id = ${deckId} AND heartbeat_at > now() - make_interval(secs => ${LOCK_TTL_SECONDS}) AND client_id <> ${clientId ?? ""}
  `) as { holder_name: string }[];
  return rows[0] ? { holderName: rows[0].holder_name } : null;
}

/** Who has the deck open for editing right now, for a read-only viewer's "X is editing" note. */
export async function currentEditor(ownerId: string, deckId: string): Promise<string | null> {
  await ensureCollabTables();
  const rows = (await sql()`
    SELECT holder_name FROM deck_locks WHERE owner_id = ${ownerId} AND deck_id = ${deckId} AND heartbeat_at > now() - make_interval(secs => ${LOCK_TTL_SECONDS})
  `) as { holder_name: string }[];
  return rows[0]?.holder_name ?? null;
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
