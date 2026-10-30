import { randomBytes } from "node:crypto";
import { sql } from "@/lib/auth/db";
import { CollabError, ensureCollabTables, resolveAccess } from "@/lib/collab-db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { getDeckData } from "@/lib/decks-db";
import { DeckSchema, type Deck } from "@/lib/deck/schema";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
type GoogleDriveCredentials = { accessToken: string; refreshToken: string; expiresAt: number };
export type GoogleDriveFile = { id: string; name: string; modifiedAt: string; url: string; deckId: string };

let ensured: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!ensured) {
    ensured = ensureCollabTables().then(async () => {
      await sql()`CREATE TABLE IF NOT EXISTS user_integrations (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, integration TEXT NOT NULL, secret TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (user_id, integration))`;
    });
    ensured.catch(() => { ensured = null; });
  }
  return ensured;
}

function clientConfig(): { id: string; secret: string } {
  const id = process.env.GOOGLE_CLIENT_ID?.trim();
  const secret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!id || !secret) throw new CollabError("Google Drive is not configured for this deployment.", 503);
  return { id, secret };
}

function decodeCredentials(value: string): GoogleDriveCredentials {
  try {
    const parsed = JSON.parse(decryptSecret(value)) as Partial<GoogleDriveCredentials>;
    if (typeof parsed.accessToken !== "string" || typeof parsed.refreshToken !== "string" || typeof parsed.expiresAt !== "number") throw new Error("Invalid token record");
    return parsed as GoogleDriveCredentials;
  } catch { throw new CollabError("The saved Google Drive connection cannot be decrypted. Reconnect it.", 503); }
}

export async function hasGoogleDriveConnection(userId: string): Promise<boolean> {
  await ensureTable();
  const rows = (await sql()`SELECT 1 FROM user_integrations WHERE user_id = ${userId} AND integration = 'google_drive'`) as unknown[];
  return rows.length > 0;
}

export async function saveGoogleDriveCredentials(userId: string, credentials: GoogleDriveCredentials): Promise<void> {
  await ensureTable();
  const secret = encryptSecret(JSON.stringify(credentials));
  await sql()`INSERT INTO user_integrations (user_id, integration, secret) VALUES (${userId}, 'google_drive', ${secret}) ON CONFLICT (user_id, integration) DO UPDATE SET secret = EXCLUDED.secret, updated_at = now()`;
}

export async function disconnectGoogleDrive(userId: string): Promise<void> {
  await ensureTable();
  await sql()`DELETE FROM user_integrations WHERE user_id = ${userId} AND integration = 'google_drive'`;
}

async function getCredentials(userId: string): Promise<GoogleDriveCredentials> {
  await ensureTable();
  const rows = (await sql()`SELECT secret FROM user_integrations WHERE user_id = ${userId} AND integration = 'google_drive'`) as { secret: string }[];
  if (!rows[0]) throw new CollabError("Connect Google Drive in Integrations first.", 409);
  return decodeCredentials(rows[0].secret);
}

async function accessToken(userId: string): Promise<string> {
  const credentials = await getCredentials(userId);
  if (credentials.expiresAt > Date.now() + 60_000) return credentials.accessToken;
  if (!credentials.refreshToken) throw new CollabError("Google Drive needs you to reconnect. Connect it again from Integrations.", 409);
  const config = clientConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: config.id, client_secret: config.secret, refresh_token: credentials.refreshToken, grant_type: "refresh_token" }),
    signal: AbortSignal.timeout(12000), redirect: "error",
  }).catch(() => { throw new CollabError("Google Drive could not be reached. Try again.", 502); });
  const refreshed = await response.json().catch(() => null) as { access_token?: string; expires_in?: number } | null;
  if (!response.ok || !refreshed?.access_token) throw new CollabError("Google Drive needs you to reconnect. Connect it again from Integrations.", 409);
  const next = { ...credentials, accessToken: refreshed.access_token, expiresAt: Date.now() + Math.max(60, refreshed.expires_in ?? 3600) * 1000 };
  await saveGoogleDriveCredentials(userId, next);
  return next.accessToken;
}

async function driveFetch(userId: string, url: string, init: RequestInit = {}): Promise<Response> {
  const token = await accessToken(userId);
  return fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...init.headers }, signal: AbortSignal.timeout(20000), redirect: "error" })
    .catch(() => { throw new CollabError("Google Drive could not be reached. Try again.", 502); });
}

function safeTitle(title: string): string {
  return title.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").replace(/\s+/g, " ").slice(0, 120) || "Untitled deck";
}

export async function saveDeckToGoogleDrive(userId: string, deckId: string): Promise<{ id: string; name: string; url: string }> {
  const access = await resolveAccess(userId, deckId);
  if (!access || access.role === "viewer") throw new CollabError("You cannot export this deck to Google Drive.", 403);
  const raw = await getDeckData(access.ownerId, deckId);
  const parsed = DeckSchema.safeParse(raw);
  if (!parsed.success) throw new CollabError("This deck could not be loaded.", 404);
  const deck: Deck = parsed.data;
  const content = JSON.stringify(deck, null, 2);
  if (Buffer.byteLength(content) > 9 * 1024 * 1024) throw new CollabError("This deck is too large for a Google Drive JSON backup.", 413);
  const boundary = `presenta_${randomBytes(12).toString("hex")}`;
  const metadata = { name: `${safeTitle(deck.title)}.presenta.json`, mimeType: "application/json", appProperties: { presenta: "studio", presentaDeckId: deck.id } };
  const payload = [
    `--${boundary}`, "Content-Type: application/json; charset=UTF-8", "", JSON.stringify(metadata),
    `--${boundary}`, "Content-Type: application/json; charset=UTF-8", "", content,
    `--${boundary}--`, "",
  ].join("\r\n");
  const url = new URL(`${UPLOAD_API}/files`);
  url.searchParams.set("uploadType", "multipart");
  url.searchParams.set("fields", "id,name,webViewLink");
  const response = await driveFetch(userId, url.toString(), { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body: payload });
  const result = await response.json().catch(() => null) as { id?: string; name?: string; webViewLink?: string; error?: { message?: string } } | null;
  if (!response.ok || !result?.id) throw new CollabError(result?.error?.message ?? "Could not save this deck to Google Drive.", 502);
  return { id: result.id, name: result.name ?? metadata.name, url: result.webViewLink ?? `https://drive.google.com/open?id=${encodeURIComponent(result.id)}` };
}

export async function listGoogleDriveBackups(userId: string): Promise<GoogleDriveFile[]> {
  const url = new URL(`${DRIVE_API}/files`);
  url.searchParams.set("q", "appProperties has { key='presenta' and value='studio' } and trashed=false");
  url.searchParams.set("orderBy", "modifiedTime desc");
  url.searchParams.set("pageSize", "50");
  url.searchParams.set("fields", "files(id,name,modifiedTime,webViewLink,appProperties)");
  const response = await driveFetch(userId, url.toString());
  const result = await response.json().catch(() => null) as { files?: { id?: string; name?: string; modifiedTime?: string; webViewLink?: string; appProperties?: Record<string, string> }[]; error?: { message?: string } } | null;
  if (!response.ok) throw new CollabError(result?.error?.message ?? "Could not list Presenta backups in Google Drive.", 502);
  return (result?.files ?? []).flatMap((file) => typeof file.id === "string" && typeof file.appProperties?.presentaDeckId === "string" ? [{ id: file.id, name: file.name ?? "Presenta deck", modifiedAt: file.modifiedTime ?? "", url: file.webViewLink ?? "", deckId: file.appProperties.presentaDeckId }] : []);
}

export async function readGoogleDriveBackup(userId: string, fileId: string): Promise<{ name: string; content: string }> {
  if (!/^[A-Za-z0-9_-]{10,100}$/.test(fileId)) throw new CollabError("Choose a valid Google Drive file.");
  const metadataUrl = new URL(`${DRIVE_API}/files/${encodeURIComponent(fileId)}`);
  metadataUrl.searchParams.set("fields", "id,name,mimeType,appProperties,trashed");
  const metaResponse = await driveFetch(userId, metadataUrl.toString());
  const meta = await metaResponse.json().catch(() => null) as { id?: string; name?: string; mimeType?: string; trashed?: boolean; appProperties?: Record<string, string>; error?: { message?: string } } | null;
  if (!metaResponse.ok || !meta || meta.trashed || meta.appProperties?.presenta !== "studio" || meta.mimeType !== "application/json") throw new CollabError("That file is not an active Presenta backup.", 404);
  const dataUrl = new URL(`${DRIVE_API}/files/${encodeURIComponent(fileId)}`);
  dataUrl.searchParams.set("alt", "media");
  const dataResponse = await driveFetch(userId, dataUrl.toString());
  if (!dataResponse.ok) throw new CollabError("Could not download that backup from Google Drive.", 502);
  const content = await dataResponse.text();
  if (Buffer.byteLength(content) > 10 * 1024 * 1024) throw new CollabError("That backup is too large to import.", 413);
  return { name: meta.name ?? "Presenta backup.json", content };
}

export async function exchangeGoogleDriveCode(code: string, origin: string): Promise<GoogleDriveCredentials> {
  const config = clientConfig();
  const redirectUri = new URL("/api/integrations/google-drive/callback", origin).toString();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: config.id, client_secret: config.secret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    signal: AbortSignal.timeout(12000), redirect: "error",
  }).catch(() => { throw new CollabError("Google authorization could not be completed. Try again.", 502); });
  const token = await response.json().catch(() => null) as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error?: string } | null;
  if (!response.ok || !token?.access_token || !token.refresh_token || !token.scope?.split(" ").includes(DRIVE_SCOPE)) throw new CollabError("Google did not grant the Drive file access Presenta needs. Try connecting again.", 400);
  return { accessToken: token.access_token, refreshToken: token.refresh_token, expiresAt: Date.now() + Math.max(60, token.expires_in ?? 3600) * 1000 };
}

export function googleDriveAuthorizationUrl(origin: string, state: string): string {
  const config = clientConfig();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({ client_id: config.id, redirect_uri: new URL("/api/integrations/google-drive/callback", origin).toString(), response_type: "code", scope: `openid email profile ${DRIVE_SCOPE}`, access_type: "offline", prompt: "consent", include_granted_scopes: "true", state }).toString();
  return url.toString();
}

export function newGoogleDriveState(): string { return randomBytes(24).toString("base64url"); }

export async function googleDrivePickerConfig(userId: string): Promise<{ accessToken: string; developerKey: string; appId: string }> {
  const developerKey = process.env.GOOGLE_PICKER_API_KEY?.trim();
  const appId = process.env.GOOGLE_CLOUD_PROJECT_NUMBER?.trim();
  if (!developerKey || !appId) throw new CollabError("Google Slides import is not configured for this deployment.", 503);
  return { accessToken: await accessToken(userId), developerKey, appId };
}

/** Exports only a Google Slides presentation selected by the signed-in user in Google Picker. */
export async function exportGoogleSlidesPptx(userId: string, fileId: string): Promise<{ name: string; bytes: ArrayBuffer }> {
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(fileId)) throw new CollabError("Choose a valid Google Slides presentation.");
  const metadataUrl = new URL(`${DRIVE_API}/files/${encodeURIComponent(fileId)}`);
  metadataUrl.searchParams.set("fields", "id,name,mimeType,trashed");
  const metaResponse = await driveFetch(userId, metadataUrl.toString());
  const meta = await metaResponse.json().catch(() => null) as { id?: string; name?: string; mimeType?: string; trashed?: boolean; error?: { message?: string } } | null;
  if (!metaResponse.ok || !meta || meta.trashed || meta.mimeType !== "application/vnd.google-apps.presentation") {
    throw new CollabError("Choose an active Google Slides presentation.", 400);
  }
  const exportUrl = new URL(`${DRIVE_API}/files/${encodeURIComponent(fileId)}/export`);
  exportUrl.searchParams.set("mimeType", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
  const response = await driveFetch(userId, exportUrl.toString());
  if (!response.ok) {
    throw new CollabError("Google could not export this presentation. Try downloading it as PowerPoint.", 502);
  }
  const declaredSize = Number(response.headers.get("content-length") ?? 0);
  if (declaredSize > 10 * 1024 * 1024) throw new CollabError("Google Slides exports are limited to 10 MB.", 413);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > 10 * 1024 * 1024) throw new CollabError("Google Slides exports are limited to 10 MB.", 413);
  const stem = (meta.name ?? "Google Slides presentation").replace(/[\\/:*?\"<>|\u0000-\u001f]/g, "-").slice(0, 120);
  return { name: `${stem || "Google Slides presentation"}.pptx`, bytes };
}
