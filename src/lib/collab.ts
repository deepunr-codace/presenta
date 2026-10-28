import { CLIENT_HEADER, getClientId } from "@/lib/client-id";
import type { DeckRole, InviteInfo, LinkAccess, PendingRequest, RequestStatus, ShareEntry, ShareRole, SharedDeck, TeamDetail, TeamSummary } from "@/lib/collab-db";

/** Browser-side calls for teams, sharing and the edit lock. The rules themselves are enforced by the API routes. */

export type { DeckRole, InviteInfo, LinkAccess, PendingRequest, RequestStatus, ShareEntry, ShareRole, SharedDeck, TeamDetail, TeamSummary };

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function call<T>(url: string, init: RequestInit | undefined, fallback: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const body = (await res.json().catch(() => null)) as ({ error?: string } & T) | null;
  if (!res.ok) throw new ApiError(body?.error ?? fallback, res.status);
  return body as T;
}

export const send = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json", [CLIENT_HEADER]: getClientId() },
  body: body === undefined ? undefined : JSON.stringify(body),
});

const deckUrl = (id: string, rest = "") => `/api/decks/${encodeURIComponent(id)}${rest}`;

/* ---------- Teams ---------- */

export const fetchTeams = () => call<{ teams: TeamSummary[]; invites: InviteInfo[] }>("/api/teams", undefined, "Could not load your teams.");
export const createTeam = (name: string) => call<{ id: string }>("/api/teams", send("POST", { name }), "Could not create the team.");
export const fetchTeam = (id: string) => call<{ team: TeamDetail }>(`/api/teams/${encodeURIComponent(id)}`, undefined, "Could not load the team.").then((r) => r.team);
export const deleteTeam = (id: string) => call<{ ok: true }>(`/api/teams/${encodeURIComponent(id)}`, send("DELETE"), "Could not delete the team.");
export const leaveTeam = (id: string) => call<{ ok: true }>(`/api/teams/${encodeURIComponent(id)}?leave=1`, send("DELETE"), "Could not leave the team.");
export const removeMember = (teamId: string, userId: string) =>
  call<{ ok: true }>(`/api/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(userId)}`, send("DELETE"), "Could not remove that person.");
export const inviteToTeam = (teamId: string, email: string) =>
  call<{ token: string }>(`/api/teams/${encodeURIComponent(teamId)}/invites`, send("POST", { email }), "Could not create the invitation.");
export const revokeInvite = (teamId: string, token: string) =>
  call<{ ok: true }>(`/api/teams/${encodeURIComponent(teamId)}/invites?token=${encodeURIComponent(token)}`, send("DELETE"), "Could not cancel the invitation.");

export type InvitePreview = { teamName: string; invitedBy: string; email: string; forYou: boolean };
export const fetchInvite = (token: string) => call<{ invite: InvitePreview }>(`/api/invites/${encodeURIComponent(token)}`, undefined, "This invitation is no longer valid.").then((r) => r.invite);
export const acceptInvite = (token: string) => call<{ teamId: string }>(`/api/invites/${encodeURIComponent(token)}`, send("POST"), "Could not join the team.");
export const declineInvite = (token: string) => call<{ ok: true }>(`/api/invites/${encodeURIComponent(token)}`, send("DELETE"), "Could not decline the invitation.");

/** The URL to send someone so they can accept an invitation. */
export const inviteUrl = (token: string) => `${window.location.origin}/invite/${token}`;

/* ---------- Sharing ---------- */

export type SharesResponse = { shares: ShareEntry[]; viaLinkCount: number };

export const fetchShares = (deckId: string) => call<SharesResponse>(deckUrl(deckId, "/shares"), undefined, "Could not load who this deck is shared with.");
export const shareWithUser = (deckId: string, email: string, role: ShareRole) =>
  call<SharesResponse>(deckUrl(deckId, "/shares"), send("POST", { kind: "user", email, role }), "Could not share the deck.");
export const shareWithTeam = (deckId: string, teamId: string, role: ShareRole) =>
  call<SharesResponse>(deckUrl(deckId, "/shares"), send("POST", { kind: "team", teamId, role }), "Could not share the deck.");
export const removeShare = (deckId: string, kind: "user" | "team", granteeId: string) =>
  call<SharesResponse>(deckUrl(deckId, `/shares?kind=${kind}&granteeId=${encodeURIComponent(granteeId)}`), send("DELETE"), "Could not remove access.");

export type LinkState = { access: LinkAccess; token: string | null };
export const fetchLink = (deckId: string) => call<{ link: LinkState }>(deckUrl(deckId, "/link"), undefined, "Could not load the link settings.").then((r) => r.link);
export const setLinkAccess = (deckId: string, access: LinkAccess) =>
  call<{ link: LinkState }>(deckUrl(deckId, "/link"), send("PUT", { access }), "Could not change the link settings.").then((r) => r.link);
export const shareLinkUrl = (token: string) => `${window.location.origin}/s/${token}`;

export const claimLink = (token: string) => call<{ deckId: string }>(`/api/shared/${encodeURIComponent(token)}`, send("POST"), "This link is not active.");
export const fetchSharedDecks = () => call<{ decks: SharedDeck[] }>("/api/shared", undefined, "Could not load shared decks.").then((r) => r.decks);

/* ---------- Edit lock ---------- */

export type AcquireResult = { state: "mine" } | { state: "held"; holderName: string };
export type HeartbeatResult = { lost: true } | { lost: false; request: PendingRequest | null };

export const lockApi = {
  acquire: (id: string) => call<AcquireResult>(deckUrl(id, "/lock"), send("POST", { action: "acquire" }), "Could not check who is editing."),
  heartbeat: (id: string) => call<HeartbeatResult>(deckUrl(id, "/lock"), send("POST", { action: "heartbeat" }), "Lost contact with the server."),
  request: (id: string) => call<{ requestId: string }>(deckUrl(id, "/lock"), send("POST", { action: "request" }), "Could not send the request."),
  respond: (id: string, requestId: string, allow: boolean) => call<{ ok: true }>(deckUrl(id, "/lock"), send("POST", { action: "respond", requestId, allow }), "Could not answer the request."),
  status: (id: string, requestId: string) =>
    call<{ status: RequestStatus }>(deckUrl(id, `/lock?request=${encodeURIComponent(requestId)}`), { headers: { [CLIENT_HEADER]: getClientId() } }, "Could not check the request.").then((r) => r.status),
  release: (id: string) => call<{ ok: true }>(deckUrl(id, "/lock"), send("POST", { action: "release" }), "Could not release the lock."),
  /** For when the tab is closing: `keepalive` lets the request finish after the page is gone. */
  releaseOnExit: (id: string) => {
    try {
      void fetch(deckUrl(id, "/lock"), { ...send("POST", { action: "release" }), keepalive: true });
    } catch {
      /* the lock expires on its own after a few seconds */
    }
  },
};
