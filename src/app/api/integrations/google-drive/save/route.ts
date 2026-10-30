import { NextResponse } from "next/server";
import { z } from "zod";
import { CollabError } from "@/lib/collab-db";
import { saveDeckToGoogleDrive } from "@/lib/integrations/google-drive";
import { bad, withUser } from "../../../_lib/guard";

const Schema = z.object({ deckId: z.string().min(1).max(100) });

export function POST(request: Request) {
  return withUser("POST /api/integrations/google-drive/save", async (user) => {
    const parsed = Schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "Choose a deck to save.");
    try { return NextResponse.json(await saveDeckToGoogleDrive(user.id, parsed.data.deckId)); }
    catch (error) { if (error instanceof CollabError) return NextResponse.json({ error: error.message }, { status: error.status }); throw error; }
  });
}
