import { NextResponse } from "next/server";
import { createDeckFromTemplate } from "@/lib/templates-db";
import { withUser } from "../../../_lib/guard";

export const runtime = "nodejs";

/**
 * POST /api/templates/[id]/use   start a new deck of mine from this template
 */

type Ctx = { params: Promise<{ id: string }> };

export function POST(_request: Request, { params }: Ctx) {
  return withUser("POST /api/templates/[id]/use", async (user) => NextResponse.json(await createDeckFromTemplate(user.id, (await params).id)));
}
