import { NextResponse } from "next/server";
import { acceptInvite, declineInvite, inviteByToken } from "@/lib/collab-db";
import { withUser } from "../../_lib/guard";

type Ctx = { params: Promise<{ token: string }> };

export function GET(_request: Request, { params }: Ctx) {
  return withUser("GET /api/invites/[token]", async (user) => {
    const invite = await inviteByToken((await params).token);
    if (!invite) return NextResponse.json({ error: "This invitation is no longer valid." }, { status: 404 });
    return NextResponse.json({ invite: { teamName: invite.teamName, invitedBy: invite.invitedBy, email: invite.email, forYou: invite.email === user.email.toLowerCase() } });
  });
}

export function POST(_request: Request, { params }: Ctx) {
  return withUser("POST /api/invites/[token]", async (user) => NextResponse.json({ teamId: await acceptInvite(user.id, user.email, (await params).token) }));
}

export function DELETE(_request: Request, { params }: Ctx) {
  return withUser("DELETE /api/invites/[token]", async (user) => {
    await declineInvite(user.email, (await params).token);
    return NextResponse.json({ ok: true });
  });
}
