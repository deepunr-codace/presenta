import { NextResponse } from "next/server";
import { z } from "zod";
import { addDeckComment, listDeckComments, setDeckCommentResolved } from "@/lib/collab-db";
import { bad, withUser } from "../../../_lib/guard";

type Ctx = { params: Promise<{ id: string }> };
const AddSchema = z.object({ body: z.string().min(1).max(4000), slideId: z.string().nullable().optional(), parentId: z.string().nullable().optional() });

export function GET(_request: Request, { params }: Ctx) {
  return withUser("GET /api/decks/[id]/comments", async (user) => NextResponse.json({ comments: await listDeckComments(user.id, (await params).id) }));
}

export function POST(request: Request, { params }: Ctx) {
  return withUser("POST /api/decks/[id]/comments", async (user) => {
    const parsed = AddSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "Invalid comment.");
    await addDeckComment(user.id, (await params).id, parsed.data.body, parsed.data.slideId ?? null, parsed.data.parentId ?? null);
    return NextResponse.json({ comments: await listDeckComments(user.id, (await params).id) }, { status: 201 });
  });
}

const ResolveSchema = z.object({ commentId: z.string().min(1), resolved: z.boolean() });
export function PATCH(request: Request, { params }: Ctx) {
  return withUser("PATCH /api/decks/[id]/comments", async (user) => {
    const parsed = ResolveSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "Invalid request.");
    await setDeckCommentResolved(user.id, (await params).id, parsed.data.commentId, parsed.data.resolved);
    return NextResponse.json({ comments: await listDeckComments(user.id, (await params).id) });
  });
}
