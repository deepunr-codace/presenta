import { NextResponse } from "next/server";
import { z } from "zod";
import { CLIENT_HEADER } from "@/lib/client-id";
import { acquireLock, heartbeat, releaseLock, requestStatus, requestTakeover, resolveAccess, respondToRequest } from "@/lib/collab-db";
import { bad, withUser, type SignedInUser } from "../../../_lib/guard";

type Ctx = { params: Promise<{ id: string }> };

/** Only an owner or editor can edit, so only they can hold or ask for the lock. */
async function editorAccess(user: SignedInUser, deckId: string): Promise<{ ownerId: string } | NextResponse> {
  const access = await resolveAccess(user.id, deckId);
  if (!access) return bad("That deck was not found.", 404);
  if (access.role === "viewer") return bad("You can view this deck but not edit it.", 403);
  return { ownerId: access.ownerId };
}

/** `?request=<id>`: where my take-over request stands. */
export function GET(request: Request, { params }: Ctx) {
  return withUser("GET /api/decks/[id]/lock", async (user) => {
    const { id } = await params;
    const clientId = request.headers.get(CLIENT_HEADER);
    const requestId = new URL(request.url).searchParams.get("request");
    if (!clientId || !requestId) return bad("Invalid request.");
    const access = await editorAccess(user, id);
    if (access instanceof NextResponse) return access;
    return NextResponse.json({ status: await requestStatus(access.ownerId, id, clientId, requestId) });
  });
}

const ActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("acquire") }),
  z.object({ action: z.literal("heartbeat") }),
  z.object({ action: z.literal("release") }),
  z.object({ action: z.literal("request") }),
  z.object({ action: z.literal("respond"), requestId: z.string().min(1), allow: z.boolean() }),
]);

/**
 * acquire: take the edit lock, or learn who holds it. heartbeat: keep it (every few seconds); the answer says if it was
 * lost and if someone is asking to take over. request: ask the holder to hand over. respond: the holder allows or declines.
 * release: let go when leaving.
 */
export function POST(request: Request, { params }: Ctx) {
  return withUser("POST /api/decks/[id]/lock", async (user) => {
    const { id } = await params;
    const clientId = request.headers.get(CLIENT_HEADER);
    if (!clientId) return bad("Missing client id.");
    const parsed = ActionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return bad("Invalid request.");
    const access = await editorAccess(user, id);
    if (access instanceof NextResponse) return access;
    const { ownerId } = access;

    switch (parsed.data.action) {
      case "acquire":
        return NextResponse.json(await acquireLock(ownerId, id, user.id, clientId));
      case "heartbeat":
        return NextResponse.json(await heartbeat(ownerId, id, clientId));
      case "release":
        await releaseLock(ownerId, id, clientId);
        return NextResponse.json({ ok: true });
      case "request":
        return NextResponse.json(await requestTakeover(ownerId, id, user.id, clientId));
      case "respond":
        await respondToRequest(ownerId, id, clientId, parsed.data.requestId, parsed.data.allow);
        return NextResponse.json({ ok: true });
    }
  });
}
