import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { z } from "zod";
import { deleteMediaRow, renameMediaRow } from "@/lib/media-db";
import { deleteObjects } from "@/lib/r2";

/** Rename an item of mine. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { id } = await params;
  const parsed = z.object({ name: z.string().trim().min(1, "Give it a name.").max(120) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid name." }, { status: 400 });
  try {
    const row = await renameMediaRow(session.user.id, id, parsed.data.name);
    if (!row) return NextResponse.json({ error: "That item was not found." }, { status: 404 });
    return NextResponse.json({ ok: true, name: row.name });
  } catch {
    return NextResponse.json({ error: "Could not rename that item. Try again." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  try {
    const row = await deleteMediaRow(session.user.id, id);
    if (!row) return NextResponse.json({ error: "That item was not found." }, { status: 404 });
    await deleteObjects([row.key, row.thumb_key]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not delete that item. Try again." }, { status: 500 });
  }
}
