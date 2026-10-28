import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteFolder, updateFolder } from "@/lib/drive-db";
import { bad, withUser } from "../../_lib/guard";

type Ctx = { params: Promise<{ id: string }> };

const PatchSchema = z.object({ name: z.string().optional(), parentId: z.string().min(1).nullable().optional() });

/** Rename a folder, or move it under another folder (`parentId: null` = the top level). */
export function PATCH(request: Request, { params }: Ctx) {
  return withUser("PATCH /api/folders/[id]", async (user) => {
    const parsed = PatchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return bad("Invalid request.");
    await updateFolder(user.id, (await params).id, parsed.data);
    return NextResponse.json({ ok: true });
  });
}

/** Deleting a folder moves what is inside it up one level; no deck is deleted. */
export function DELETE(_request: Request, { params }: Ctx) {
  return withUser("DELETE /api/folders/[id]", async (user) => {
    await deleteFolder(user.id, (await params).id);
    return NextResponse.json({ ok: true });
  });
}
