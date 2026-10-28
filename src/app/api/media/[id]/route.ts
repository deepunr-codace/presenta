import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteMediaRow } from "@/lib/media-db";
import { deleteObjects } from "@/lib/r2";

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
