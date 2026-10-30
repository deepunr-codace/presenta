import { NextResponse } from "next/server";
import { z } from "zod";
import { TEMPLATE_CATEGORIES, TEMPLATE_SCOPES } from "@/lib/template-scopes";
import { deleteTemplate, updateTemplate } from "@/lib/templates-db";
import { withUser } from "../../_lib/guard";
import { readJsonBody } from "../../_lib/respond";

export const runtime = "nodejs";

/**
 * PATCH  /api/templates/[id]   rename it, change its category, or change who can see it (owner only)
 * DELETE /api/templates/[id]   remove it from the library (owner only)
 */

type Ctx = { params: Promise<{ id: string }> };

const PatchSchema = z
  .object({
    title: z.string().max(80).optional(),
    description: z.string().max(240).optional(),
    category: z.enum(TEMPLATE_CATEGORIES).optional(),
    scope: z.enum(TEMPLATE_SCOPES).optional(),
    teamIds: z.array(z.string().min(1).max(120)).max(25).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to change." });

export function PATCH(request: Request, { params }: Ctx) {
  return withUser("PATCH /api/templates/[id]", async (user) => {
    const body = await readJsonBody(request, PatchSchema);
    if (!body.ok) return body.response;
    const template = await updateTemplate(user.id, (await params).id, body.data);
    return NextResponse.json({ template });
  });
}

export function DELETE(_request: Request, { params }: Ctx) {
  return withUser("DELETE /api/templates/[id]", async (user) => {
    await deleteTemplate(user.id, (await params).id);
    return NextResponse.json({ ok: true });
  });
}
