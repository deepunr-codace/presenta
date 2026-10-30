import { sql } from "@/lib/auth/db";
import { CollabError, ensureCollabTables, resolveAccess } from "@/lib/collab-db";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { getDeckData } from "@/lib/decks-db";

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

export function validateSlackWebhook(raw: string): string {
  let url: URL;
  try { url = new URL(raw.trim()); } catch { throw new CollabError("Enter a valid Slack incoming webhook URL."); }
  if (url.protocol !== "https:" || url.hostname !== "hooks.slack.com" || !/^\/services\/[A-Z0-9]+\/[A-Z0-9]+\/[A-Za-z0-9_-]+$/.test(url.pathname) || url.search || url.hash || url.username || url.password) {
    throw new CollabError("Use a Slack webhook URL from hooks.slack.com.");
  }
  return url.toString();
}

export async function setSlackWebhook(userId: string, raw: string | null): Promise<void> {
  await ensureTable();
  if (raw === null) {
    await sql()`DELETE FROM user_integrations WHERE user_id = ${userId} AND integration = 'slack'`;
    return;
  }
  const encrypted = encryptSecret(validateSlackWebhook(raw));
  await sql()`INSERT INTO user_integrations (user_id, integration, secret) VALUES (${userId}, 'slack', ${encrypted}) ON CONFLICT (user_id, integration) DO UPDATE SET secret = EXCLUDED.secret, updated_at = now()`;
}

export async function hasSlackWebhook(userId: string): Promise<boolean> {
  await ensureTable();
  const rows = (await sql()`SELECT 1 FROM user_integrations WHERE user_id = ${userId} AND integration = 'slack'`) as unknown[];
  return rows.length > 0;
}

export function validateZapierHook(raw: string): string {
  let url: URL;
  try { url = new URL(raw.trim()); } catch { throw new CollabError("Enter a valid Zapier Catch Hook URL."); }
  if (url.protocol !== "https:" || url.hostname !== "hooks.zapier.com" || !/^\/hooks\/catch\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/?$/.test(url.pathname) || url.search || url.hash || url.username || url.password) {
    throw new CollabError("Use a Zapier Catch Hook URL from hooks.zapier.com.");
  }
  return url.toString();
}

export async function setZapierHook(userId: string, raw: string | null): Promise<void> {
  await ensureTable();
  if (raw === null) {
    await sql()`DELETE FROM user_integrations WHERE user_id = ${userId} AND integration = 'zapier'`;
    return;
  }
  const encrypted = encryptSecret(validateZapierHook(raw));
  await sql()`INSERT INTO user_integrations (user_id, integration, secret) VALUES (${userId}, 'zapier', ${encrypted}) ON CONFLICT (user_id, integration) DO UPDATE SET secret = EXCLUDED.secret, updated_at = now()`;
}

export async function hasZapierHook(userId: string): Promise<boolean> {
  await ensureTable();
  const rows = (await sql()`SELECT 1 FROM user_integrations WHERE user_id = ${userId} AND integration = 'zapier'`) as unknown[];
  return rows.length > 0;
}

async function getSlackWebhook(userId: string): Promise<string | null> {
  await ensureTable();
  const rows = (await sql()`SELECT secret FROM user_integrations WHERE user_id = ${userId} AND integration = 'slack'`) as { secret: string }[];
  if (!rows[0]) return null;
  try { return decryptSecret(rows[0].secret); } catch { throw new CollabError("The saved Slack connection cannot be decrypted. Reconnect it.", 503); }
}

export async function postDeckToSlack(userId: string, deckId: string, title: string, deckUrl: string): Promise<void> {
  const access = await resolveAccess(userId, deckId);
  if (!access) throw new CollabError("That deck could not be found.", 404);
  const webhook = await getSlackWebhook(userId);
  if (!webhook) throw new CollabError("Connect Slack in Integrations first.", 409);
  const links = (await sql()`SELECT token FROM deck_links WHERE owner_id = ${access.ownerId} AND deck_id = ${deckId} AND access = 'anyone_view' LIMIT 1`) as { token: string }[];
  if (links[0]) deckUrl = new URL(`/s/${links[0].token}`, deckUrl).toString();
  const escapes: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };
  const safeTitle = title.replace(/[&<>]/g, (c) => escapes[c] ?? c).slice(0, 160);
  const res = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: `New presentation: ${safeTitle}`, blocks: [{ type: "section", text: { type: "mrkdwn", text: `*<${deckUrl}|${safeTitle}>*` } }] }),
    signal: AbortSignal.timeout(8000),
    redirect: "error",
  }).catch(() => { throw new CollabError("Slack could not be reached. Try again.", 502); });
  if (!res.ok) throw new CollabError("Slack rejected the message. Check your webhook connection.", 502);
}

export async function postDeckToZapier(userId: string, deckId: string, appUrl: string): Promise<void> {
  const access = await resolveAccess(userId, deckId);
  if (!access) throw new CollabError("That deck could not be found.", 404);
  await ensureTable();
  const rows = (await sql()`SELECT secret FROM user_integrations WHERE user_id = ${userId} AND integration = 'zapier'`) as { secret: string }[];
  if (!rows[0]) throw new CollabError("Connect Zapier in Integrations first.", 409);
  let webhook: string;
  try { webhook = decryptSecret(rows[0].secret); } catch { throw new CollabError("The saved Zapier connection cannot be decrypted. Reconnect it.", 503); }
  const raw = await getDeckData(access.ownerId, deckId);
  if (!raw || typeof raw !== "object") throw new CollabError("That deck could not be loaded.", 404);
  const deck = raw as { id?: unknown; title?: unknown; slides?: unknown[] };
  if (typeof deck.id !== "string" || !Array.isArray(deck.slides)) throw new CollabError("That deck could not be loaded.", 404);
  const publicLinks = (await sql()`SELECT token FROM deck_links WHERE owner_id = ${access.ownerId} AND deck_id = ${deckId} AND access = 'anyone_view' LIMIT 1`) as { token: string }[];
  const deckUrl = publicLinks[0] ? new URL(`/s/${publicLinks[0].token}`, appUrl).toString() : new URL(`/deck/${encodeURIComponent(deckId)}`, appUrl).toString();
  const payload = JSON.stringify({ event: "deck.shared", title: typeof deck.title === "string" ? deck.title : "Untitled deck", deckUrl, deck: raw });
  if (Buffer.byteLength(payload) > 5 * 1024 * 1024) throw new CollabError("This deck is too large to send to Zapier (5 MB maximum). Export it as JSON instead.", 413);
  const res = await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, signal: AbortSignal.timeout(8000), redirect: "error" }).catch(() => { throw new CollabError("Zapier could not be reached. Try again.", 502); });
  if (!res.ok) throw new CollabError("Zapier rejected the event. Check your Catch Hook.", 502);
}
