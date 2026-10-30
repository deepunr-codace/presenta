import { NextResponse } from "next/server";
import { z } from "zod";
import { CollabError } from "@/lib/collab-db";
import { postDeckToZapier } from "@/lib/integrations/slack";
import { withUser } from "../../../_lib/guard";

const Schema = z.object({ deckId: z.string().min(1).max(100) });

export function POST(request: Request) {
  return withUser("POST /api/integrations/zapier/trigger", async (user) => {
    const parsed = Schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid deck." }, { status: 400 });
    try {
      await postDeckToZapier(user.id, parsed.data.deckId, request.url);
      return NextResponse.json({ ok: true });
    } catch (error) {
      if (error instanceof CollabError) return NextResponse.json({ error: error.message }, { status: error.status });
      throw error;
    }
  });
}
