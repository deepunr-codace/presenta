import { sql } from "@/lib/auth/db";
import { CollabError, ensureCollabTables } from "@/lib/collab-db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

const API = "https://api.notion.com/v1";
const API_VERSION = "2026-03-11";
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

function normalizeToken(raw: string): string {
  const token = raw.trim();
  if (token.length < 20 || token.length > 500 || /\s/.test(token)) throw new CollabError("Enter a valid Notion internal integration token.");
  return token;
}

async function notionFetch(token: string, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Notion-Version": API_VERSION, ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
    signal: AbortSignal.timeout(12000),
    redirect: "error",
  }).catch(() => { throw new CollabError("Notion could not be reached. Try again.", 502); });
}

async function savedToken(userId: string): Promise<string | null> {
  await ensureTable();
  const rows = (await sql()`SELECT secret FROM user_integrations WHERE user_id = ${userId} AND integration = 'notion'`) as { secret: string }[];
  if (!rows[0]) return null;
  try { return decryptSecret(rows[0].secret); }
  catch { throw new CollabError("The saved Notion connection cannot be decrypted. Reconnect it.", 503); }
}

export async function hasNotionToken(userId: string): Promise<boolean> {
  return Boolean(await savedToken(userId));
}

export async function setNotionToken(userId: string, raw: string | null): Promise<void> {
  await ensureTable();
  if (raw === null) {
    await sql()`DELETE FROM user_integrations WHERE user_id = ${userId} AND integration = 'notion'`;
    return;
  }
  const token = normalizeToken(raw);
  const response = await notionFetch(token, "/users/me");
  if (!response.ok) throw new CollabError(response.status === 401 ? "Notion rejected that token. Check the integration token and try again." : "Could not verify the Notion connection.", response.status === 401 ? 400 : 502);
  const encrypted = encryptSecret(token);
  await sql()`INSERT INTO user_integrations (user_id, integration, secret) VALUES (${userId}, 'notion', ${encrypted}) ON CONFLICT (user_id, integration) DO UPDATE SET secret = EXCLUDED.secret, updated_at = now()`;
}

function pageTitle(page: Record<string, unknown>): string {
  const properties = page.properties && typeof page.properties === "object" ? Object.values(page.properties as Record<string, Record<string, unknown>>) : [];
  const titleProperty = properties.find((property) => property.type === "title" && Array.isArray(property.title));
  const titleItems = titleProperty?.title as { plain_text?: string; text?: { content?: string } }[] | undefined;
  const title = titleItems?.map((item) => item.plain_text ?? item.text?.content ?? "").join("").trim();
  return title || "Untitled page";
}

export async function searchNotionPages(userId: string, query: string): Promise<{ id: string; title: string; url: string; editedAt: string }[]> {
  const token = await savedToken(userId);
  if (!token) throw new CollabError("Connect Notion in Integrations first.", 409);
  const response = await notionFetch(token, "/search", {
    method: "POST", body: JSON.stringify({ query: query.trim().slice(0, 100), page_size: 30, sort: { direction: "descending", timestamp: "last_edited_time" }, filter: { property: "object", value: "page" } }),
  });
  if (!response.ok) throw new CollabError(response.status === 401 ? "Notion needs you to reconnect this integration." : "Could not search your Notion pages.", response.status === 401 ? 409 : 502);
  const body = await response.json() as { results?: Record<string, unknown>[] };
  return (body.results ?? []).filter((item) => typeof item.id === "string").map((item) => ({ id: item.id as string, title: pageTitle(item), url: typeof item.url === "string" ? item.url : "", editedAt: typeof item.last_edited_time === "string" ? item.last_edited_time : "" }));
}

type NotionBlock = { id?: string; type?: string; has_children?: boolean; [key: string]: unknown };

function blockText(block: NotionBlock): string {
  const kind = block.type;
  if (!kind || !block[kind] || typeof block[kind] !== "object") return "";
  const data = block[kind] as Record<string, unknown>;
  const rich = data.rich_text;
  const text = Array.isArray(rich) ? rich.map((part) => {
    if (!part || typeof part !== "object") return "";
    const item = part as { plain_text?: string; text?: { content?: string } };
    return item.plain_text ?? item.text?.content ?? "";
  }).join("") : "";
  if (kind.startsWith("heading_")) return `\n${text}\n`;
  if (kind === "bulleted_list_item") return `• ${text}`;
  if (kind === "numbered_list_item") return `- ${text}`;
  if (kind === "to_do") return `${data.checked ? "☑" : "☐"} ${text}`;
  if (kind === "quote" || kind === "callout") return `“${text}”`;
  if (kind === "code") return text;
  if (kind === "child_page" && typeof data.title === "string") return data.title;
  if (kind === "bookmark" && typeof data.url === "string") return data.url;
  return text;
}

async function blockChildren(token: string, blockId: string): Promise<NotionBlock[]> {
  const blocks: NotionBlock[] = [];
  let cursor = "";
  for (let page = 0; page < 10; page += 1) {
    const url = new URL(`${API}/blocks/${encodeURIComponent(blockId)}/children`);
    url.searchParams.set("page_size", "100");
    if (cursor) url.searchParams.set("start_cursor", cursor);
    const response = await notionFetch(token, `${url.pathname}${url.search}`);
    if (!response.ok) throw new CollabError(response.status === 404 ? "Notion could not find that page. Check that the integration can access it." : "Could not read that Notion page.", response.status === 404 ? 404 : 502);
    const body = await response.json() as { results?: NotionBlock[]; has_more?: boolean; next_cursor?: string | null };
    blocks.push(...(body.results ?? []));
    if (!body.has_more || !body.next_cursor) break;
    cursor = body.next_cursor;
  }
  return blocks;
}

export async function readNotionPage(userId: string, pageId: string): Promise<{ title: string; text: string; url: string }> {
  if (!/^[\da-f-]{32,36}$/i.test(pageId)) throw new CollabError("Choose a valid Notion page.");
  const token = await savedToken(userId);
  if (!token) throw new CollabError("Connect Notion in Integrations first.", 409);
  const pageResponse = await notionFetch(token, `/pages/${encodeURIComponent(pageId)}`);
  if (!pageResponse.ok) throw new CollabError(pageResponse.status === 404 ? "Notion could not find that page, or the integration has not been invited to it." : "Could not read that Notion page.", pageResponse.status === 404 ? 404 : 502);
  const page = await pageResponse.json() as Record<string, unknown>;
  const lines: string[] = [];
  let visited = 0;
  const visit = async (parentId: string, depth: number): Promise<void> => {
    if (depth > 2 || visited >= 1000) return;
    const children = await blockChildren(token, parentId);
    for (const block of children) {
      if (visited++ >= 1000) return;
      const text = blockText(block).trim();
      if (text) lines.push(text);
      if (block.has_children && block.id && depth < 2) await visit(block.id, depth + 1);
      if (lines.join("\n").length >= 30000) return;
    }
  };
  await visit(pageId, 0);
  const title = pageTitle(page);
  const text = lines.join("\n").slice(0, 30000).trim();
  if (!text) throw new CollabError("That Notion page has no text content to import.");
  return { title, text: `Notion page: ${title}\n\n${text}`, url: typeof page.url === "string" ? page.url : "" };
}
