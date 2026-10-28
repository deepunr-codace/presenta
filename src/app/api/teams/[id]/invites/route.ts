import { NextResponse } from "next/server";
import { z } from "zod";
import { createInvite, revokeInvite } from "@/lib/collab-db";
import { bad, withUser } from "../../../_lib/guard";

type Ctx = { params: Promise<{ id: string }> };

const InviteSchema = z.object({ email: z.string().trim().email("Enter a valid email.") });

/**
 * Invite someone by email. No email is sent: the invitation shows on their Teams page once they sign in with that
 * address, and the returned token makes a link (/invite/<token>) the owner can send themselves.
 */
export function POST(request: Request, { params }: Ctx) {
  return withUser("POST /api/teams/[id]/invites", async (user) => {
    const parsed = InviteSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "Invalid input.");
    return NextResponse.json(await createInvite(user.id, (await params).id, parsed.data.email));
  });
}

export function DELETE(request: Request, { params }: Ctx) {
  return withUser("DELETE /api/teams/[id]/invites", async (user) => {
    const inviteToken = new URL(request.url).searchParams.get("token");
    if (!inviteToken) return bad("Missing invitation.");
    await revokeInvite(user.id, (await params).id, inviteToken);
    return NextResponse.json({ ok: true });
  });
}
