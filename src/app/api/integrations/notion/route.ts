import { NextResponse } from "next/server";
import { z } from "zod";
import { CollabError } from "@/lib/collab-db";
import { hasNotionToken, setNotionToken } from "@/lib/integrations/notion";
import { withUser } from "../../_lib/guard";

const Schema = z.object({ token: z.string().trim().max(500).nullable() });

export function GET() {
  return withUser("GET /api/integrations/notion", async (user) => NextResponse.json({ connected: await hasNotionToken(user.id) }));
}

export function PUT(request: Request) {
  return withUser("PUT /api/integrations/notion", async (user) => {
    const parsed = Schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid Notion token." }, { status: 400 });
    try {
      await setNotionToken(user.id, parsed.data.token);
      return NextResponse.json({ connected: parsed.data.token !== null });
    } catch (error) {
      if (error instanceof CollabError) return NextResponse.json({ error: error.message }, { status: error.status });
      throw error;
    }
  });
}
