import { sql } from "@/lib/auth/db";
import { ensureCollabTables } from "@/lib/collab-db";
import { newId } from "@/lib/deck/ids";
import { DeckImportSchema, DeckSchema, type Deck } from "@/lib/deck/schema";
import { ensureDeckTables, getDeckData, upsertDeck } from "@/lib/decks-db";
import { assertRoom } from "@/lib/storage";
import type { TemplateCategory, TemplateScope } from "@/lib/template-scopes";

/**
 * The templates library, stored in Postgres. A saved template is a deck snapshot plus the details the gallery shows,
 * and a scope that decides who can find it: only me, the teams I publish it to, or everyone signed in.
 *
 * Every function takes the acting user's id and applies the visibility rule itself, so the API routes stay thin.
 * Server only.
 */

export type TemplateEntry = {
  id: string;
  title: string;
  description: string;
  category: TemplateCategory;
  scope: TemplateScope;
  /** Teams the template is published to (empty unless `scope` is "team"). */
  teamIds: string[];
  /** Names of those teams. */
  teamNames: string[];
  ownerId: string;
  ownerName: string;
  isMine: boolean;
  slideCount: number;
  themeId: string;
  createdAt: string;
  updatedAt: string;
};

export type NewTemplateInput = {
  /** Falls back to the deck's own title when empty. */
  title?: string;
  description?: string;
  category: TemplateCategory;
  scope: TemplateScope;
  teamIds?: string[];
  /** One of my own decks to publish, or a deck object (an uploaded file). */
  deckId?: string;
  deck?: unknown;
};

export type TemplatePatch = {
  title?: string;
  description?: string;
  category?: TemplateCategory;
  scope?: TemplateScope;
  teamIds?: string[];
};

/** A template body is a whole deck; the request cap is a little under what the host accepts. */
export const TEMPLATE_MAX_BYTES = 4 * 1024 * 1024;

/** A problem the user can fix or should be told about; `status` is the HTTP status the route answers with. */
export class TemplateError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "TemplateError";
  }
}

const iso = (v: string | Date) => new Date(v).toISOString();

let ensured: Promise<void> | null = null;

/** Creates the `templates` and `template_teams` tables on first use. Safe to call repeatedly. */
export function ensureTemplateTables(): Promise<void> {
  if (!ensured) {
    ensured = Promise.all([ensureDeckTables(), ensureCollabTables()])
      .then(
        () => sql()`
          CREATE TABLE IF NOT EXISTS templates (
            id TEXT PRIMARY KEY,
            owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            category TEXT NOT NULL DEFAULT 'Business',
            scope TEXT NOT NULL DEFAULT 'personal',
            theme_id TEXT NOT NULL,
            slide_count INTEGER NOT NULL,
            data JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        `,
      )
      .then(
        () => sql()`
          CREATE TABLE IF NOT EXISTS template_teams (
            template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
            team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
            PRIMARY KEY (template_id, team_id)
          )
        `,
      )
      .then(() => sql()`CREATE INDEX IF NOT EXISTS templates_owner ON templates (owner_id, updated_at DESC)`)
      .then(() => sql()`CREATE INDEX IF NOT EXISTS templates_scope ON templates (scope)`)
      .then(() => undefined);
    ensured.catch(() => (ensured = null));
  }
  return ensured;
}

/* ---------- reading ---------- */

type TemplateRow = {
  id: string;
  title: string;
  description: string;
  category: string;
  scope: string;
  owner_id: string;
  owner_name: string;
  theme_id: string;
  slide_count: number;
  created_at: string;
  updated_at: string;
};

type TeamLinkRow = { template_id: string; team_id: string; team_name: string };

/**
 * Templates this user may find: their own, everything published globally, and everything published to a team they
 * belong to. The predicate is spelled out in each query because a tagged template cannot take a SQL fragment.
 */
export async function listVisibleTemplates(userId: string): Promise<TemplateEntry[]> {
  await ensureTemplateTables();
  const rows = (await sql()`
    SELECT t.id, t.title, t.description, t.category, t.scope, t.owner_id,
      COALESCE(u.name, u.email) AS owner_name, t.theme_id, t.slide_count, t.created_at, t.updated_at
    FROM templates t JOIN users u ON u.id = t.owner_id
    WHERE t.owner_id = ${userId}
       OR t.scope = 'global'
       OR (t.scope = 'team' AND EXISTS (
            SELECT 1 FROM template_teams tt JOIN team_members m ON m.team_id = tt.team_id
            WHERE tt.template_id = t.id AND m.user_id = ${userId}
          ))
    ORDER BY t.updated_at DESC
  `) as TemplateRow[];
  if (!rows.length) return [];

  // Team names for the badges: the owner sees every team they published to, everyone else only teams they are in.
  const links = (await sql()`
    SELECT tt.template_id, tt.team_id, tm.name AS team_name
    FROM template_teams tt
    JOIN teams tm ON tm.id = tt.team_id
    JOIN templates t ON t.id = tt.template_id
    WHERE (
        t.owner_id = ${userId}
        OR t.scope = 'global'
        OR (t.scope = 'team' AND EXISTS (
             SELECT 1 FROM template_teams x JOIN team_members m ON m.team_id = x.team_id
             WHERE x.template_id = t.id AND m.user_id = ${userId}
           ))
      )
      AND (t.owner_id = ${userId} OR EXISTS (
        SELECT 1 FROM team_members m2 WHERE m2.team_id = tt.team_id AND m2.user_id = ${userId}
      ))
    ORDER BY tm.name ASC
  `) as TeamLinkRow[];

  const byTemplate = new Map<string, TeamLinkRow[]>();
  for (const link of links) {
    const list = byTemplate.get(link.template_id) ?? [];
    list.push(link);
    byTemplate.set(link.template_id, list);
  }
  return rows.map((r) => toEntry(r, byTemplate.get(r.id) ?? [], userId));
}

function toEntry(r: TemplateRow, links: TeamLinkRow[], userId: string): TemplateEntry {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    category: r.category as TemplateCategory,
    scope: r.scope as TemplateScope,
    teamIds: links.map((l) => l.team_id),
    teamNames: links.map((l) => l.team_name),
    ownerId: r.owner_id,
    ownerName: r.owner_name,
    isMine: r.owner_id === userId,
    slideCount: r.slide_count,
    themeId: r.theme_id,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

/** One template this user may see, or a 404. */
export async function getTemplateEntry(userId: string, id: string): Promise<TemplateEntry> {
  await ensureTemplateTables();
  const rows = (await sql()`
    SELECT t.id, t.title, t.description, t.category, t.scope, t.owner_id,
      COALESCE(u.name, u.email) AS owner_name, t.theme_id, t.slide_count, t.created_at, t.updated_at
    FROM templates t JOIN users u ON u.id = t.owner_id
    WHERE t.id = ${id}
      AND (
        t.owner_id = ${userId}
        OR t.scope = 'global'
        OR (t.scope = 'team' AND EXISTS (
             SELECT 1 FROM template_teams tt JOIN team_members m ON m.team_id = tt.team_id
             WHERE tt.template_id = t.id AND m.user_id = ${userId}
           ))
      )
    LIMIT 1
  `) as TemplateRow[];
  const row = rows[0];
  if (!row) throw new TemplateError("That template was not found.", 404);

  const links = (row.owner_id === userId
    ? await sql()`
        SELECT tt.template_id, tt.team_id, tm.name AS team_name
        FROM template_teams tt JOIN teams tm ON tm.id = tt.team_id
        WHERE tt.template_id = ${id} ORDER BY tm.name ASC
      `
    : await sql()`
        SELECT tt.template_id, tt.team_id, tm.name AS team_name
        FROM template_teams tt JOIN teams tm ON tm.id = tt.team_id
        WHERE tt.template_id = ${id}
          AND EXISTS (SELECT 1 FROM team_members m WHERE m.team_id = tt.team_id AND m.user_id = ${userId})
        ORDER BY tm.name ASC
      `) as TeamLinkRow[];
  return toEntry(row, links, userId);
}

/* ---------- writing ---------- */

function cleanTitle(value: string | undefined, fallback: string): string {
  const title = (value ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  return title || fallback.trim().slice(0, 80) || "Untitled template";
}

function cleanDescription(value: string | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").slice(0, 240);
}

/** The team ids this user belongs to, as a set. */
async function myTeamIds(userId: string): Promise<Set<string>> {
  const rows = (await sql()`SELECT team_id FROM team_members WHERE user_id = ${userId}`) as { team_id: string }[];
  return new Set(rows.map((r) => r.team_id));
}

/** Keep only teams the user belongs to; publishing to someone else's team is refused. */
async function checkedTeams(userId: string, teamIds: string[]): Promise<string[]> {
  const wanted = [...new Set(teamIds.filter(Boolean))];
  if (!wanted.length) return [];
  const mine = await myTeamIds(userId);
  const stranger = wanted.find((teamId) => !mine.has(teamId));
  if (stranger) throw new TemplateError("You can only publish a template to teams you belong to.", 403);
  return wanted;
}

function parseDeck(value: unknown): Deck {
  const parsed = DeckImportSchema.safeParse(value);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first?.path.length ? ` at ${first.path.join(".")}` : "";
    throw new TemplateError(`That file is not a Presenta deck${where}: ${first?.message ?? "invalid"}.`, 422);
  }
  return parsed.data;
}

async function resolveDeck(userId: string, input: NewTemplateInput): Promise<Deck> {
  if (input.deckId) {
    // Only decks of mine can be published; a deck shared with me is not mine to republish.
    const data = await getDeckData(userId, input.deckId);
    if (!data) throw new TemplateError("That deck was not found in your library.", 404);
    return parseDeck(data);
  }
  if (input.deck !== undefined) return parseDeck(input.deck);
  throw new TemplateError("Choose one of your decks, or upload a deck file.");
}

async function saveTeamLinks(templateId: string, teamIds: string[]): Promise<void> {
  await sql()`DELETE FROM template_teams WHERE template_id = ${templateId}`;
  for (const teamId of teamIds) {
    await sql()`INSERT INTO template_teams (template_id, team_id) VALUES (${templateId}, ${teamId}) ON CONFLICT DO NOTHING`;
  }
}

/** Save a deck as a template with a scope. Returns the gallery entry as the owner sees it. */
export async function createTemplate(userId: string, input: NewTemplateInput): Promise<TemplateEntry> {
  await ensureTemplateTables();
  const deck = await resolveDeck(userId, input);

  const json = JSON.stringify(deck);
  if (Buffer.byteLength(json) > TEMPLATE_MAX_BYTES) {
    throw new TemplateError(`That deck is larger than the ${TEMPLATE_MAX_BYTES / 1024 / 1024} MB template limit.`, 413);
  }

  const teamIds = input.scope === "team" ? await checkedTeams(userId, input.teamIds ?? []) : [];
  if (input.scope === "team" && !teamIds.length) throw new TemplateError("Pick at least one team to publish to.");

  const id = newId("tpl");
  await sql()`
    INSERT INTO templates (id, owner_id, title, description, category, scope, theme_id, slide_count, data)
    VALUES (
      ${id}, ${userId}, ${cleanTitle(input.title, deck.title)}, ${cleanDescription(input.description)},
      ${input.category}, ${input.scope}, ${deck.themeId}, ${deck.slides.length}, ${json}::jsonb
    )
  `;
  await saveTeamLinks(id, teamIds);
  return getTemplateEntry(userId, id);
}

/** Change the title, description, category or who can see a template. Owner only. */
export async function updateTemplate(ownerId: string, id: string, patch: TemplatePatch): Promise<TemplateEntry> {
  await ensureTemplateTables();
  const rows = (await sql()`SELECT owner_id FROM templates WHERE id = ${id}`) as { owner_id: string }[];
  if (!rows[0]) throw new TemplateError("That template no longer exists.", 404);
  if (rows[0].owner_id !== ownerId) throw new TemplateError("Only the owner can change this template.", 403);

  if (patch.title !== undefined) {
    const title = cleanTitle(patch.title, "Untitled template");
    await sql()`UPDATE templates SET title = ${title}, updated_at = now() WHERE id = ${id}`;
  }
  if (patch.description !== undefined) {
    await sql()`UPDATE templates SET description = ${cleanDescription(patch.description)}, updated_at = now() WHERE id = ${id}`;
  }
  if (patch.category !== undefined) {
    await sql()`UPDATE templates SET category = ${patch.category}, updated_at = now() WHERE id = ${id}`;
  }
  if (patch.scope !== undefined) {
    const teamIds = patch.scope === "team" ? await checkedTeams(ownerId, patch.teamIds ?? []) : [];
    if (patch.scope === "team" && !teamIds.length) throw new TemplateError("Pick at least one team to publish to.");
    await sql()`UPDATE templates SET scope = ${patch.scope}, updated_at = now() WHERE id = ${id}`;
    await saveTeamLinks(id, teamIds);
  } else if (patch.teamIds !== undefined) {
    // Changing the teams of a template that is already team scoped.
    const teamIds = await checkedTeams(ownerId, patch.teamIds);
    if (!teamIds.length) throw new TemplateError("Pick at least one team to publish to.");
    await saveTeamLinks(id, teamIds);
    await sql()`UPDATE templates SET updated_at = now() WHERE id = ${id}`;
  }
  return getTemplateEntry(ownerId, id);
}

/** Remove a template from the library. Owner only; decks people made from it are theirs to keep. */
export async function deleteTemplate(ownerId: string, id: string): Promise<void> {
  await ensureTemplateTables();
  const rows = (await sql()`SELECT owner_id FROM templates WHERE id = ${id}`) as { owner_id: string }[];
  if (!rows[0]) throw new TemplateError("That template no longer exists.", 404);
  if (rows[0].owner_id !== ownerId) throw new TemplateError("Only the owner can delete this template.", 403);
  await sql()`DELETE FROM templates WHERE id = ${id}`;
}

/**
 * Start a new deck of mine from a template. The template itself is never changed, and every deck made from it gets
 * its own id and timestamps.
 */
export async function createDeckFromTemplate(userId: string, id: string): Promise<{ deckId: string; title: string }> {
  await ensureTemplateTables();
  const rows = (await sql()`
    SELECT t.data FROM templates t
    WHERE t.id = ${id}
      AND (
        t.owner_id = ${userId}
        OR t.scope = 'global'
        OR (t.scope = 'team' AND EXISTS (
             SELECT 1 FROM template_teams tt JOIN team_members m ON m.team_id = tt.team_id
             WHERE tt.template_id = t.id AND m.user_id = ${userId}
           ))
      )
    LIMIT 1
  `) as { data: unknown }[];
  const row = rows[0];
  if (!row) throw new TemplateError("That template was not found.", 404);

  const parsed = DeckSchema.safeParse(row.data);
  if (!parsed.success) throw new TemplateError("This template's deck could not be read. Ask its owner to publish it again.", 422);

  const now = new Date().toISOString();
  const deck: Deck = { ...structuredClone(parsed.data), id: newId("deck"), createdAt: now, updatedAt: now };
  await assertRoom(userId, Buffer.byteLength(JSON.stringify(deck)));
  await upsertDeck(userId, deck);
  return { deckId: deck.id, title: deck.title };
}
