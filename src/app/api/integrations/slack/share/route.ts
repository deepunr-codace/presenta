import { NextResponse } from "next/server";
import { z } from "zod";
import { CollabError } from "@/lib/collab-db";
import { postDeckToSlack } from "@/lib/integrations/slack";
import { bad, withUser } from "../../../_lib/guard";

const Schema = z.object({ deckId: z.string().min(1).max(100), title: z.string().trim().min(1).max(240) });

export function POST(request: Request) {
  return withUser("POST /api/integrations/slack/share", async (user) => {
    const parsed = Schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "Invalid deck.");
    const url = new URL(`/deck/${encodeURIComponent(parsed.data.deckId)}`, request.url).toString();
    try {
      await postDeckToSlack(user.id, parsed.data.deckId, parsed.data.title, url);
      return NextResponse.json({ ok: true });
    } catch (error) {
      if (error instanceof CollabError) return NextResponse.json({ error: error.message }, { status: error.status });
      throw error;
    }
  });
}
