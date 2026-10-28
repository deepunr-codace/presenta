import { NextResponse } from "next/server";
import { deleteTeam, getTeam, removeMember } from "@/lib/collab-db";
import { withUser } from "../../_lib/guard";

type Ctx = { params: Promise<{ id: string }> };

export function GET(_request: Request, { params }: Ctx) {
  return withUser("GET /api/teams/[id]", async (user) => NextResponse.json({ team: await getTeam(user.id, (await params).id) }));
}

/** The owner deletes the team; `?leave=1` makes a member leave it instead. */
export function DELETE(request: Request, { params }: Ctx) {
  return withUser("DELETE /api/teams/[id]", async (user) => {
    const { id } = await params;
    if (new URL(request.url).searchParams.get("leave") === "1") await removeMember(user.id, id, user.id);
    else await deleteTeam(user.id, id);
    return NextResponse.json({ ok: true });
  });
}
