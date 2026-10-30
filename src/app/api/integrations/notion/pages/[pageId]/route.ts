import { NextResponse } from "next/server";
import { CollabError } from "@/lib/collab-db";
import { readNotionPage } from "@/lib/integrations/notion";
import { withUser } from "../../../../_lib/guard";

type Params = { params: Promise<{ pageId: string }> };

export function GET(_request: Request, { params }: Params) {
  return withUser("GET /api/integrations/notion/pages/[pageId]", async (user) => {
    const { pageId } = await params;
    try { return NextResponse.json(await readNotionPage(user.id, pageId)); }
    catch (error) {
      if (error instanceof CollabError) return NextResponse.json({ error: error.message }, { status: error.status });
      throw error;
    }
  });
}
