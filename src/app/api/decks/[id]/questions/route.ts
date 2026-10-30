import { NextResponse } from "next/server";
import { z } from "zod";
import { CollabError, listDeckAudienceQuestions, moderateDeckAudienceQuestion } from "@/lib/collab-db";
import { bad, withUser } from "../../../_lib/guard";

type Params = { params: Promise<{ id: string }> };

export function GET(_request: Request, { params }: Params) {
  return withUser("GET /api/decks/[id]/questions", async (user) => {
    try { return NextResponse.json({ questions: await listDeckAudienceQuestions(user.id, (await params).id) }); }
    catch (error) { if (error instanceof CollabError) return NextResponse.json({ error: error.message }, { status: error.status }); throw error; }
  });
}

const PatchSchema = z.object({ questionId: z.string().min(1).max(100), hidden: z.boolean().optional(), answered: z.boolean().optional() }).refine((value) => value.hidden !== undefined || value.answered !== undefined);
export function PATCH(request: Request, { params }: Params) {
  return withUser("PATCH /api/decks/[id]/questions", async (user) => {
    const parsed = PatchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "Invalid question update.");
    try {
      const { questionId, ...patch } = parsed.data;
      await moderateDeckAudienceQuestion(user.id, (await params).id, questionId, patch);
      return NextResponse.json({ questions: await listDeckAudienceQuestions(user.id, (await params).id) });
    } catch (error) { if (error instanceof CollabError) return NextResponse.json({ error: error.message }, { status: error.status }); throw error; }
  });
}
