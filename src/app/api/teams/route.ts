import { NextResponse } from "next/server";
import { z } from "zod";
import { createTeam, invitesForEmail, listTeams } from "@/lib/collab-db";
import { bad, withUser } from "../_lib/guard";

/** My teams, plus invitations addressed to my email. */
export function GET() {
  return withUser("GET /api/teams", async (user) => {
    const [teams, invites] = await Promise.all([listTeams(user.id), invitesForEmail(user.email)]);
    return NextResponse.json({ teams, invites });
  });
}

const CreateSchema = z.object({ name: z.string().trim().min(1, "Give the team a name.").max(60) });

export function POST(request: Request) {
  return withUser("POST /api/teams", async (user) => {
    const parsed = CreateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "Invalid input.");
    return NextResponse.json({ id: await createTeam(user.id, parsed.data.name) });
  });
}
