import { NextResponse } from "next/server";
import { z } from "zod";
import { TEMPLATE_CATEGORIES, TEMPLATE_SCOPES } from "@/lib/template-scopes";
import { createTemplate, listVisibleTemplates, TEMPLATE_MAX_BYTES } from "@/lib/templates-db";
import { withUser } from "../_lib/guard";
import { readJsonBody } from "../_lib/respond";
import { adminUser } from "@/lib/admin-guard";

export const runtime = "nodejs";

/**
 * GET  /api/templates   templates I can use: mine, my teams' and the global library
 * POST /api/templates   publish a deck as a template, personally, to teams or globally
 */

const NewTemplateSchema = z
  .object({
    /** Falls back to the deck's own title when left out. */
    title: z.string().max(80).optional(),
    description: z.string().max(240).optional(),
    category: z.enum(TEMPLATE_CATEGORIES),
    scope: z.enum(TEMPLATE_SCOPES),
    teamIds: z.array(z.string().min(1).max(120)).max(25).optional(),
    /** One of my own decks … */
    deckId: z.string().min(1).max(120).optional(),
    /** … or a whole deck (a file the user picked). */
    deck: z.unknown().optional(),
  })
  .refine((v) => Boolean(v.deckId) || v.deck !== undefined, { message: "Choose one of your decks, or upload a deck file." });

export function GET() {
  return withUser("GET /api/templates", async (user) => NextResponse.json({ templates: await listVisibleTemplates(user.id) }));
}

export function POST(request: Request) {
  return withUser("POST /api/templates", async (user) => {
    const body = await readJsonBody(request, NewTemplateSchema, TEMPLATE_MAX_BYTES);
    if (!body.ok) return body.response;
    if (body.data.scope === "global" && !(await adminUser())) {
      return NextResponse.json({ error: "Only an admin can publish a template for everyone. Share it with a team instead." }, { status: 403 });
    }
    const template = await createTemplate(user.id, body.data);
    return NextResponse.json({ template }, { status: 201 });
  });
}
