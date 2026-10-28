import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listDriveDecks } from "@/lib/drive-db";
import { emptyTrashRows, listAllDeckIds, listDeckRows, purgeExpiredTrash } from "@/lib/decks-db";
import { TRASH_RETENTION_DAYS } from "@/lib/persist";

/**
 * GET /api/decks            decks in the list, newest first
 * GET /api/decks?trash=1    decks in the trash (expired ones are purged first)
 * GET /api/decks?ids=1      every deck id, trash included (used to avoid id clashes on import)
 * DELETE /api/decks?trash=1 empty the trash
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const params = new URL(request.url).searchParams;

  try {
    if (params.get("ids")) return NextResponse.json({ ids: await listAllDeckIds(session.user.id) });
    const trash = params.get("trash") === "1";
    if (trash) {
      await purgeExpiredTrash(session.user.id, TRASH_RETENTION_DAYS);
      return NextResponse.json({ decks: await listDeckRows(session.user.id, true) });
    }
    // The list carries each deck's folder, size and who it is shared with, for the Decks page.
    return NextResponse.json({ decks: await listDriveDecks(session.user.id) });
  } catch (err) {
    console.error("GET /api/decks failed", err);
    return NextResponse.json({ error: "Could not load your decks." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (new URL(request.url).searchParams.get("trash") !== "1") return NextResponse.json({ error: "Nothing to delete." }, { status: 400 });

  try {
    await emptyTrashRows(session.user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/decks failed", err);
    return NextResponse.json({ error: "Could not empty the trash." }, { status: 500 });
  }
}
