import { NextResponse } from "next/server";
import { z } from "zod";
import { listDeckShares, removeShare, shareWithTeam, shareWithUser } from "@/lib/collab-db";
import { bad, withUser } from "../../../_lib/guard";

type Ctx = { params: Promise<{ id: string }> };

/** Who a deck is shared with. Owner only. */
export function GET(_request: Request, { params }: Ctx) {
  return withUser("GET /api/decks/[id]/shares", async (user) => NextResponse.json(await listDeckShares(user.id, (await params).id)));
}

const AddSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("user"), email: z.string().trim().email("Enter a valid email."), role: z.enum(["editor", "viewer"]) }),
  z.object({ kind: z.literal("team"), teamId: z.string().min(1), role: z.enum(["editor", "viewer"]) }),
]);

export function POST(request: Request, { params }: Ctx) {
  return withUser("POST /api/decks/[id]/shares", async (user) => {
    const parsed = AddSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "Invalid input.");
    const { id } = await params;
    if (parsed.data.kind === "user") await shareWithUser(user.id, id, parsed.data.email, parsed.data.role);
    else await shareWithTeam(user.id, id, parsed.data.teamId, parsed.data.role);
    return NextResponse.json(await listDeckShares(user.id, id));
  });
}

export function DELETE(request: Request, { params }: Ctx) {
  return withUser("DELETE /api/decks/[id]/shares", async (user) => {
    const q = new URL(request.url).searchParams;
    const kind = q.get("kind");
    const granteeId = q.get("granteeId");
    if ((kind !== "user" && kind !== "team") || !granteeId) return bad("Invalid request.");
    const { id } = await params;
    await removeShare(user.id, id, kind, granteeId);
    return NextResponse.json(await listDeckShares(user.id, id));
  });
}
