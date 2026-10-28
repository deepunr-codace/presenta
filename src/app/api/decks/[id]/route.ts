import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { CLIENT_HEADER } from "@/lib/client-id";
import { CollabError, currentEditor, lockBlocksSave, resolveAccess } from "@/lib/collab-db";
import { deleteDeckRow, getDeckData, setDeckTrashed, updateDeckContent, upsertDeck } from "@/lib/decks-db";
import { DeckSchema } from "@/lib/deck/schema";
import { assertRoom, deckSize, StorageFullError } from "@/lib/storage";

/**
 * GET    /api/decks/[id]   – load a deck (owner or shared)
 * PUT    /api/decks/[id]   – save / upsert a deck (owner or shared editor)
 * PATCH  /api/decks/[id]   – trash / restore / move to folder
 * DELETE /api/decks/[id]   – permanently delete a deck (owner only)
 */

type Params = { params: Promise<{ id: string }> };

/* ---------- GET ---------- */

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;

  try {
    const access = await resolveAccess(session.user.id, id);
    if (!access) return NextResponse.json({ error: "Deck not found." }, { status: 404 });

    const data = await getDeckData(access.ownerId, id);
    if (!data) return NextResponse.json({ error: "Deck not found." }, { status: 404 });

    const editor = await currentEditor(access.ownerId, id);
    return NextResponse.json({ deck: data, role: access.role, editor });
  } catch (err) {
    if (err instanceof CollabError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("GET /api/decks/[id] failed", err);
    return NextResponse.json({ error: "The deck could not be loaded." }, { status: 500 });
  }
}

/* ---------- PUT ---------- */

export async function PUT(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const parsed = DeckSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: first?.message ?? "Invalid deck." }, { status: 400 });
  }
  const deck = parsed.data;

  if (deck.id !== id) return NextResponse.json({ error: "Deck id in the body does not match the URL." }, { status: 400 });

  const clientId = req.headers.get(CLIENT_HEADER) ?? null;

  try {
    const access = await resolveAccess(session.user.id, id);

    if (!access) {
      // New deck: only the owner may create it (the deck's user id must equal the signed-in user).
      const json = JSON.stringify(deck);
      const size = Buffer.byteLength(json);
      await assertRoom(session.user.id, size);
      await upsertDeck(session.user.id, deck);
      return NextResponse.json({ ok: true });
    }

    if (access.role === "viewer") {
      return NextResponse.json({ error: "You can only view this deck." }, { status: 403 });
    }

    // Check the edit lock: refuse if another tab/person holds it.
    const blocked = await lockBlocksSave(access.ownerId, id, clientId);
    if (blocked) {
      return NextResponse.json({ error: `${blocked.holderName} is editing this deck. Save is blocked.` }, { status: 409 });
    }

    const json = JSON.stringify(deck);
    const newSize = Buffer.byteLength(json);
    const oldSize = await deckSize(access.ownerId, id);
    await assertRoom(access.ownerId, newSize, oldSize);

    if (access.role === "owner") {
      await upsertDeck(access.ownerId, deck);
    } else {
      // editor: update content only, never move out of trash or change ownership
      const updated = await updateDeckContent(access.ownerId, deck);
      if (!updated) return NextResponse.json({ error: "Deck not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof CollabError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof StorageFullError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    console.error("PUT /api/decks/[id] failed", err);
    return NextResponse.json({ error: "The deck could not be saved." }, { status: 500 });
  }
}

/* ---------- PATCH ---------- */

const PatchSchema = z.object({
  trashed: z.boolean().optional(),
  folderId: z.string().nullable().optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid patch." }, { status: 400 });
  const patch = parsed.data;

  try {
    // Only the owner may trash/restore/move.
    if (patch.trashed !== undefined) {
      const ok = await setDeckTrashed(session.user.id, id, patch.trashed);
      if (!ok) return NextResponse.json({ error: "Deck not found." }, { status: 404 });
    }

    if (patch.folderId !== undefined) {
      // moveDeck lives in drive-db; import lazily to keep the common path fast.
      const { moveDeck } = await import("@/lib/drive-db");
      await moveDeck(session.user.id, id, patch.folderId);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof CollabError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("PATCH /api/decks/[id] failed", err);
    return NextResponse.json({ error: "The deck could not be updated." }, { status: 500 });
  }
}

/* ---------- DELETE ---------- */

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;

  try {
    // Permanent delete is owner-only; the row check doubles as existence check.
    await deleteDeckRow(session.user.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/decks/[id] failed", err);
    return NextResponse.json({ error: "The deck could not be deleted." }, { status: 500 });
  }
}
