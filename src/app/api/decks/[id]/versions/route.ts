import { NextResponse } from "next/server";
import { sanitizeDeckText } from "@/lib/deck/sanitize";
import { z } from "zod";
import { CLIENT_HEADER } from "@/lib/client-id";
import { CollabError, holdsEditLock, resolveAccess } from "@/lib/collab-db";
import { createDeckVersion, getDeckVersion, listDeckVersions, updateDeckContent, upsertDeck } from "@/lib/decks-db";
import { assertRoom, deckSize, StorageFullError } from "@/lib/storage";
import { bad, withUser } from "../../../_lib/guard";

type Ctx = { params: Promise<{ id: string }> };
const Schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("checkpoint"), label: z.string().trim().max(80).optional() }),
  z.object({ action: z.literal("restore"), versionId: z.string().min(1).max(100) }),
]);

export function GET(_request: Request, { params }: Ctx) {
  return withUser("GET /api/decks/[id]/versions", async (user) => {
    const { id } = await params;
    const access = await resolveAccess(user.id, id);
    if (!access) return bad("That deck was not found.", 404);
    return NextResponse.json({ versions: await listDeckVersions(access.ownerId, id) });
  });
}

export function POST(request: Request, { params }: Ctx) {
  return withUser("POST /api/decks/[id]/versions", async (user) => {
    const parsed = Schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "Invalid version action.");
    const { id } = await params;
    const access = await resolveAccess(user.id, id);
    if (!access) return bad("That deck was not found.", 404);
    if (access.role === "viewer") return bad("You can only view this deck.", 403);
    const clientId = request.headers.get(CLIENT_HEADER);
    if (!clientId || !(await holdsEditLock(access.ownerId, id, clientId))) return bad("Open this deck in the editor before changing version history.", 409);

    if (parsed.data.action === "checkpoint") {
      const versionId = await createDeckVersion(access.ownerId, id, user.id, parsed.data.label || "Checkpoint");
      return NextResponse.json({ versionId, versions: await listDeckVersions(access.ownerId, id) }, { status: 201 });
    }

    const snapshot = await getDeckVersion(access.ownerId, id, parsed.data.versionId);
    if (!snapshot) return bad("That version could not be found.", 404);
    try {
      await createDeckVersion(access.ownerId, id, user.id, "Before restoring a version");
      const restored = sanitizeDeckText({ ...snapshot, updatedAt: new Date().toISOString() });
      const jsonSize = Buffer.byteLength(JSON.stringify(restored));
      const oldSize = await deckSize(access.ownerId, id);
      await assertRoom(access.ownerId, jsonSize, oldSize);
      if (access.role === "owner") await upsertDeck(access.ownerId, restored);
      else if (!(await updateDeckContent(access.ownerId, restored))) return bad("That deck was not found.", 404);
      return NextResponse.json({ deck: restored, versions: await listDeckVersions(access.ownerId, id) });
    } catch (error) {
      if (error instanceof CollabError) return NextResponse.json({ error: error.message }, { status: error.status });
      if (error instanceof StorageFullError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
      throw error;
    }
  });
}
