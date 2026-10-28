import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveAccess } from "@/lib/collab-db";
import { recordEvent } from "@/lib/drive-db";
import { bad, withUser } from "../../../_lib/guard";

const EventSchema = z.object({ kind: z.enum(["view", "present"]) });

/** Note that I opened a deck for viewing or presenting. Anyone with access can record it; it feeds the owner's analytics. */
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withUser("POST /api/decks/[id]/events", async (user) => {
    const parsed = EventSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return bad("Invalid request.");
    const { id } = await params;
    const access = await resolveAccess(user.id, id);
    if (!access) return bad("That deck was not found.", 404);
    await recordEvent(access.ownerId, id, user.id, parsed.data.kind);
    return NextResponse.json({ ok: true });
  });
}
