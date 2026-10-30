import { NextResponse } from "next/server";
import { z } from "zod";
import { bad, withUser } from "../../../_lib/guard";
import { resolveAccess, CollabError } from "@/lib/collab-db";
import { DeckSchema } from "@/lib/deck/schema";
import { getDeckData } from "@/lib/decks-db";
import { createRemoteSession, revokeRemoteSession } from "@/lib/remote-control";

type Context = { params: Promise<{ id: string }> };
const RequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), slideIndex: z.number().int().min(0).max(99) }),
  z.object({ action: z.literal("stop") }),
]);

export function POST(request: Request, { params }: Context) {
  return withUser("POST /api/decks/[id]/remote", async (user) => {
    const { id } = await params;
    const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return bad("Invalid remote-control request.");
    const access = await resolveAccess(user.id, id);
    if (!access) return bad("That deck was not found.", 404);
    if (access.role === "viewer") return bad("You can view this deck but not create a remote-control link.", 403);

    if (parsed.data.action === "stop") {
      await revokeRemoteSession(access.ownerId, id);
      return NextResponse.json({ ok: true });
    }

    const deckData = DeckSchema.safeParse(await getDeckData(access.ownerId, id));
    if (!deckData.success || !deckData.data.slides.length) throw new CollabError("This deck has no slides to control.", 409);
    if (parsed.data.slideIndex >= deckData.data.slides.length) return bad("That slide is outside this deck.");
    const session = await createRemoteSession(access.ownerId, id, deckData.data.slides.length, parsed.data.slideIndex);
    return NextResponse.json(session, { headers: { "Cache-Control": "no-store" } });
  });
}
