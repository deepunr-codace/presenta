import { NextResponse } from "next/server";
import { z } from "zod";
import { CollabError, createDeckAudiencePoll, endDeckAudiencePoll, listDeckAudiencePolls } from "@/lib/collab-db";
import { bad, withUser } from "../../../_lib/guard";

type Params = { params: Promise<{ id: string }> };

export function GET(_request: Request, { params }: Params) {
  return withUser("GET /api/decks/[id]/polls", async (user) => {
    try { return NextResponse.json({ polls: await listDeckAudiencePolls(user.id, (await params).id) }); }
    catch (error) { if (error instanceof CollabError) return NextResponse.json({ error: error.message }, { status: error.status }); throw error; }
  });
}

const CreateSchema = z.object({ action: z.literal("create"), prompt: z.string().trim().min(3).max(200), options: z.array(z.string().trim().min(1).max(80)).min(2).max(6) });
const EndSchema = z.object({ action: z.literal("end"), pollId: z.string().min(1).max(100) });
const Schema = z.discriminatedUnion("action", [CreateSchema, EndSchema]);

export function POST(request: Request, { params }: Params) {
  return withUser("POST /api/decks/[id]/polls", async (user) => {
    const parsed = Schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "Invalid poll.");
    try {
      const { id } = await params;
      const polls = parsed.data.action === "create"
        ? await createDeckAudiencePoll(user.id, id, parsed.data.prompt, parsed.data.options)
        : await endDeckAudiencePoll(user.id, id, parsed.data.pollId);
      return NextResponse.json({ polls }, { status: parsed.data.action === "create" ? 201 : 200 });
    } catch (error) { if (error instanceof CollabError) return NextResponse.json({ error: error.message }, { status: error.status }); throw error; }
  });
}
