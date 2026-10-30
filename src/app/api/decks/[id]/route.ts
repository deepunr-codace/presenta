import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { CollabError, currentEditor, resolveAccess } from "@/lib/collab-db";
import { compareAndSwapDeckContent, createAutoDeckVersion, deleteDeckRow, getDeckData, setDeckTrashed, upsertDeck } from "@/lib/decks-db";
import { DeckSchema } from "@/lib/deck/schema";
import { mergeDecks } from "@/lib/deck/merge";
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

  const envelope = z.object({ deck: DeckSchema, base: DeckSchema.nullable().optional() }).safeParse(body);
  let deck: z.infer<typeof DeckSchema>;
  let base: z.infer<typeof DeckSchema> | null = null;
  if (envelope.success) {
    deck = envelope.data.deck;
    base = envelope.data.base ?? null;
  } else {
    const parsed = DeckSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return NextResponse.json({ error: first?.message ?? "Invalid deck." }, { status: 400 });
    }
    deck = parsed.data;
  }

  if (deck.id !== id) return NextResponse.json({ error: "Deck id in the body does not match the URL." }, { status: 400 });

  try {
    const access = await resolveAccess(session.user.id, id);

    if (!access) {
      if (base) return NextResponse.json({ error: "You no longer have access to this deck." }, { status: 404 });
      // New deck: only the owner may create it (the deck's user id must equal the signed-in user).
      const json = JSON.stringify(deck);
      const size = Buffer.byteLength(json);
      await assertRoom(session.user.id, size);
      await upsertDeck(session.user.id, deck);
      return NextResponse.json({ ok: true, deck });
    }

    if (access.role === "viewer") {
      return NextResponse.json({ error: "You can only view this deck." }, { status: 403 });
    }

    const oldSize = await deckSize(access.ownerId, id);
    await createAutoDeckVersion(access.ownerId, id, session.user.id);
    let savedDeck: typeof deck | null = null;
    // Re-read and retry if another save lands between our read and conditional write.
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const remoteParsed = DeckSchema.safeParse(await getDeckData(access.ownerId, id));
      if (!remoteParsed.success) return NextResponse.json({ error: "The saved deck could not be merged." }, { status: 409 });
      const remote = remoteParsed.data;
      const baseline = base ?? remote;
      const comparable = (value: typeof remote) => JSON.stringify({ ...value, updatedAt: "" });
      const candidate = comparable(remote) === comparable(baseline) ? deck : mergeDecks(baseline, deck, remote);
      candidate.updatedAt = new Date(Math.max(Date.now(), Date.parse(remote.updatedAt) + 1)).toISOString();
      const json = JSON.stringify(candidate);
      await assertRoom(access.ownerId, Buffer.byteLength(json), oldSize);
      if (await compareAndSwapDeckContent(access.ownerId, candidate, remote.updatedAt)) {
        savedDeck = candidate;
        break;
      }
    }
    if (!savedDeck) return NextResponse.json({ error: "This deck changed repeatedly while saving. Please save again." }, { status: 409 });
    return NextResponse.json({ ok: true, deck: savedDeck });
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
