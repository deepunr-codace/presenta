import { CLIENT_HEADER, getClientId } from "@/lib/client-id";
import type { Deck } from "@/lib/deck/schema";
import type { AudiencePoll, AudienceQuestion, DeckComment, DeckRole, InviteInfo, LinkAccess, PendingRequest, RequestStatus, ShareEntry, ShareRole, SharedDeck, TeamDetail, TeamMessage, TeamSummary } from "@/lib/collab-db";
import type { DeckVersionSummary } from "@/lib/decks-db";

/** Browser-side calls for teams, sharing and the edit lock. The rules themselves are enforced by the API routes. */

export type { AudiencePoll, AudienceQuestion, DeckComment, DeckRole, DeckVersionSummary, InviteInfo, LinkAccess, PendingRequest, RequestStatus, ShareEntry, ShareRole, SharedDeck, TeamDetail, TeamMessage, TeamSummary };

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const shareAccessStorageKey = (token: string) => `presenta.share-access.${token}`;
const shareAccessMemory = new Map<string, string>();
export function storeShareAccessToken(token: string, accessToken: string): void {
  shareAccessMemory.set(token, accessToken);
  try { window.sessionStorage.setItem(shareAccessStorageKey(token), accessToken); } catch { /* in-memory page can still use the current session */ }
}

function withShareAuthorization(url: string, init?: RequestInit): RequestInit {
  const match = /^\/api\/shared\/([^/?]+)/.exec(url);
  const headers = new Headers(init?.headers);
  if (match && typeof window !== "undefined") {
    try {
      const token = decodeURIComponent(match[1]);
      const accessToken = shareAccessMemory.get(token) ?? window.sessionStorage.getItem(shareAccessStorageKey(token));
      if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    } catch { /* private mode can disable session storage */ }
  }
  return { ...init, headers };
}

export async function call<T>(url: string, init: RequestInit | undefined, fallback: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...withShareAuthorization(url, init) });
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

export const fetchDeckComments = (id: string) => call<{ comments: DeckComment[] }>(deckUrl(id, "/comments"), undefined, "Could not load comments.").then((r) => r.comments);
export const postDeckComment = (id: string, body: string, slideId: string | null, parentId: string | null) => call<{ comments: DeckComment[] }>(deckUrl(id, "/comments"), send("POST", { body, slideId, parentId }), "Could not post your comment.").then((r) => r.comments);
export const resolveDeckComment = (id: string, commentId: string, resolved: boolean) => call<{ comments: DeckComment[] }>(deckUrl(id, "/comments"), send("PATCH", { commentId, resolved }), "Could not update that comment.").then((r) => r.comments);

export const fetchSlackStatus = () => call<{ connected: boolean }>("/api/integrations/slack", undefined, "Could not check Slack.");
export const saveSlackWebhook = (webhookUrl: string | null) => call<{ connected: boolean }>("/api/integrations/slack", send("PUT", { webhookUrl }), "Could not save the Slack connection.");
export const postDeckToSlack = (deckId: string, title: string) => call<{ ok: true }>("/api/integrations/slack/share", send("POST", { deckId, title }), "Could not post this deck to Slack.");
export const fetchZapierStatus = () => call<{ connected: boolean }>("/api/integrations/zapier", undefined, "Could not check Zapier.");
export const saveZapierHook = (webhookUrl: string | null) => call<{ connected: boolean }>("/api/integrations/zapier", send("PUT", { webhookUrl }), "Could not save the Zapier connection.");
export const triggerZapier = (deckId: string) => call<{ ok: true }>("/api/integrations/zapier/trigger", send("POST", { deckId }), "Could not send this deck to Zapier.");
export type NotionPage = { id: string; title: string; url: string; editedAt: string };
export const fetchNotionStatus = () => call<{ connected: boolean }>("/api/integrations/notion", undefined, "Could not check Notion.");
export const saveNotionToken = (token: string | null) => call<{ connected: boolean }>("/api/integrations/notion", send("PUT", { token }), "Could not save the Notion connection.");
export const searchNotionPages = (query: string) => call<{ pages: NotionPage[] }>(`/api/integrations/notion/pages?q=${encodeURIComponent(query)}`, undefined, "Could not search Notion pages.").then((r) => r.pages);
export const importNotionPage = (pageId: string) => call<{ title: string; text: string; url: string }>(`/api/integrations/notion/pages/${encodeURIComponent(pageId)}`, undefined, "Could not import that Notion page.");
export type GoogleDriveBackup = { id: string; name: string; modifiedAt: string; url: string; deckId: string };
export const fetchGoogleDriveStatus = () => call<{ connected: boolean }>("/api/integrations/google-drive", undefined, "Could not check Google Drive.");
export const disconnectGoogleDrive = () => call<{ connected: false }>("/api/integrations/google-drive", send("DELETE"), "Could not disconnect Google Drive.");
export const fetchGoogleDriveBackups = () => call<{ files: GoogleDriveBackup[] }>("/api/integrations/google-drive/files", undefined, "Could not load Google Drive backups.").then((r) => r.files);
export const readGoogleDriveBackup = (fileId: string) => call<{ name: string; content: string }>(`/api/integrations/google-drive/files/${encodeURIComponent(fileId)}`, undefined, "Could not download that Google Drive backup.");
export const saveDeckToGoogleDrive = (deckId: string) => call<{ id: string; name: string; url: string }>("/api/integrations/google-drive/save", send("POST", { deckId }), "Could not save this deck to Google Drive.");

export const fetchDeckVersions = (deckId: string) => call<{ versions: DeckVersionSummary[] }>(deckUrl(deckId, "/versions"), undefined, "Could not load version history.").then((r) => r.versions);
export const createDeckCheckpoint = (deckId: string, label: string) => call<{ versions: DeckVersionSummary[] }>(deckUrl(deckId, "/versions"), send("POST", { action: "checkpoint", label }), "Could not save this checkpoint.").then((r) => r.versions);
export const restoreDeckVersion = (deckId: string, versionId: string) => call<{ deck: Deck; versions: DeckVersionSummary[] }>(deckUrl(deckId, "/versions"), send("POST", { action: "restore", versionId }), "Could not restore this version.");

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

/* ---------- Team chat ---------- */

/** The team's messages, newest page by default, or only what was posted after `after` when polling. */
export const fetchTeamMessages = (teamId: string, after?: string | null) => {
  const query = after ? `?after=${encodeURIComponent(after)}` : "";
  return call<{ messages: TeamMessage[] }>(`/api/teams/${encodeURIComponent(teamId)}/messages${query}`, undefined, "Could not load the team chat.").then((r) => r.messages);
};
export const sendTeamMessage = (teamId: string, body: string) =>
  call<{ message: TeamMessage }>(`/api/teams/${encodeURIComponent(teamId)}/messages`, send("POST", { body }), "Could not send your message.").then((r) => r.message);

/* ---------- Sharing ---------- */

export type SharesResponse = { shares: ShareEntry[]; viaLinkCount: number };

export const fetchShares = (deckId: string) => call<SharesResponse>(deckUrl(deckId, "/shares"), undefined, "Could not load who this deck is shared with.");
export const shareWithUser = (deckId: string, email: string, role: ShareRole) =>
  call<SharesResponse>(deckUrl(deckId, "/shares"), send("POST", { kind: "user", email, role }), "Could not share the deck.");
export const shareWithTeam = (deckId: string, teamId: string, role: ShareRole) =>
  call<SharesResponse>(deckUrl(deckId, "/shares"), send("POST", { kind: "team", teamId, role }), "Could not share the deck.");
export const removeShare = (deckId: string, kind: "user" | "team", granteeId: string) =>
  call<SharesResponse>(deckUrl(deckId, `/shares?kind=${kind}&granteeId=${encodeURIComponent(granteeId)}`), send("DELETE"), "Could not remove access.");

export type LinkState = { access: LinkAccess; token: string | null; expiresAt: string | null; passwordEnabled: boolean };
export const fetchLink = (deckId: string) => call<{ link: LinkState }>(deckUrl(deckId, "/link"), undefined, "Could not load the link settings.").then((r) => r.link);
export const setLinkAccess = (deckId: string, access: LinkAccess) =>
  call<{ link: LinkState }>(deckUrl(deckId, "/link"), send("PUT", { access }), "Could not change the link settings.").then((r) => r.link);
export const setLinkExpiry = (deckId: string, expiresInHours: 24 | 168 | 720 | null) =>
  call<{ link: LinkState }>(deckUrl(deckId, "/link"), send("PUT", { expiresInHours }), "Could not change the link expiry.").then((r) => r.link);
export const setLinkPassword = (deckId: string, password: string | null) =>
  call<{ link: LinkState }>(deckUrl(deckId, "/link"), send("PUT", { password }), "Could not update the share password.").then((r) => r.link);
export const shareLinkUrl = (token: string) => `${window.location.origin}/s/${token}`;

export const claimLink = (token: string) => call<{ deckId: string }>(`/api/shared/${encodeURIComponent(token)}`, send("POST"), "This link is not active.");
export const fetchPublicDeck = async (token: string): Promise<Deck | null> => {
  const result = await call<{ deck?: Deck; passwordRequired?: boolean }>(`/api/shared/${encodeURIComponent(token)}`, undefined, "This link is not active.");
  if (result.passwordRequired) return null;
  if (!result.deck) throw new ApiError("This link is not active.", 404);
  return result.deck;
};
export const authenticatePublicLink = async (token: string, password: string): Promise<void> => {
  const result = await call<{ accessToken: string }>(`/api/shared/${encodeURIComponent(token)}/access`, send("POST", { password }), "Could not unlock this presentation.");
  storeShareAccessToken(token, result.accessToken);
};
export const fetchPublicQuestions = (token: string) => call<{ questions: AudienceQuestion[] }>(`/api/shared/${encodeURIComponent(token)}/questions`, undefined, "Could not load audience questions.").then((r) => r.questions);
export const postPublicQuestion = (token: string, payload: { visitorId: string; name: string; body: string; slideNumber: number }) => call<{ questions: AudienceQuestion[] }>(`/api/shared/${encodeURIComponent(token)}/questions`, send("POST", payload), "Could not post your question.").then((r) => r.questions);
export const fetchDeckAudienceQuestions = (id: string) => call<{ questions: AudienceQuestion[] }>(deckUrl(id, "/questions"), undefined, "Could not load audience questions.").then((r) => r.questions);
export const moderateDeckQuestion = (id: string, questionId: string, patch: { hidden?: boolean; answered?: boolean }) => call<{ questions: AudienceQuestion[] }>(deckUrl(id, "/questions"), send("PATCH", { questionId, ...patch }), "Could not update that question.").then((r) => r.questions);
export const fetchDeckAudiencePolls = (id: string) => call<{ polls: AudiencePoll[] }>(deckUrl(id, "/polls"), undefined, "Could not load audience polls.").then((r) => r.polls);
export const createDeckAudiencePoll = (id: string, prompt: string, options: string[]) => call<{ polls: AudiencePoll[] }>(deckUrl(id, "/polls"), send("POST", { action: "create", prompt, options }), "Could not start the poll.").then((r) => r.polls);
export const endDeckAudiencePoll = (id: string, pollId: string) => call<{ polls: AudiencePoll[] }>(deckUrl(id, "/polls"), send("POST", { action: "end", pollId }), "Could not end the poll.").then((r) => r.polls);
export const fetchPublicPoll = (token: string, visitorId: string) => call<{ poll: (AudiencePoll & { myVote: number | null }) | null }>(`/api/shared/${encodeURIComponent(token)}/polls?visitorId=${encodeURIComponent(visitorId)}`, undefined, "Could not load the live poll.").then((r) => r.poll);
export const votePublicPoll = (token: string, payload: { visitorId: string; pollId: string; optionIndex: number }) => call<{ poll: AudiencePoll & { myVote: number | null } }>(`/api/shared/${encodeURIComponent(token)}/polls`, send("POST", payload), "Could not submit your vote.").then((r) => r.poll);
export const recordPublicShareEvent = (token: string, visitorId: string, kind: "view" | "present") => fetch(`/api/shared/${encodeURIComponent(token)}/events`, withShareAuthorization(`/api/shared/${encodeURIComponent(token)}/events`, send("POST", { visitorId, kind }))).catch(() => undefined);
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
