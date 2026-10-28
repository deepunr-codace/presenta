import { NextResponse } from "next/server";
import { removeMember } from "@/lib/collab-db";
import { withUser } from "../../../../_lib/guard";

/** The team owner removes a member. */
export function DELETE(_request: Request, { params }: { params: Promise<{ id: string; userId: string }> }) {
  return withUser("DELETE /api/teams/[id]/members/[userId]", async (user) => {
    const { id, userId } = await params;
    await removeMember(user.id, id, userId);
    return NextResponse.json({ ok: true });
  });
}
