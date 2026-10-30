import { NextResponse } from "next/server";
import { CollabError } from "@/lib/collab-db";
import { searchNotionPages } from "@/lib/integrations/notion";
import { withUser } from "../../../_lib/guard";

export function GET(request: Request) {
  return withUser("GET /api/integrations/notion/pages", async (user) => {
    const query = new URL(request.url).searchParams.get("q") ?? "";
    try { return NextResponse.json({ pages: await searchNotionPages(user.id, query) }); }
    catch (error) {
      if (error instanceof CollabError) return NextResponse.json({ error: error.message }, { status: error.status });
      throw error;
    }
  });
}
