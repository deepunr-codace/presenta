import { NextResponse } from "next/server";
import { z } from "zod";
import { TEAM_MESSAGE_MAX, listTeamMessages, sendTeamMessage } from "@/lib/collab-db";
import { withUser } from "../../../_lib/guard";
import { readJsonBody } from "../../../_lib/respond";

export const runtime = "nodejs";

/**
 * GET  /api/teams/[id]/messages            the newest messages (team members only)
 * GET  /api/teams/[id]/messages?after=<id>  only what was posted after that message (polling)
 * POST /api/teams/[id]/messages            post a message
 */

type Ctx = { params: Promise<{ id: string }> };

const MessageSchema = z.object({ body: z.string().min(1).max(TEAM_MESSAGE_MAX) });

export function GET(request: Request, { params }: Ctx) {
  return withUser("GET /api/teams/[id]/messages", async (user) => {
    const after = new URL(request.url).searchParams.get("after");
    const messages = await listTeamMessages(user.id, (await params).id, after);
    return NextResponse.json({ messages });
  });
}

export function POST(request: Request, { params }: Ctx) {
  return withUser("POST /api/teams/[id]/messages", async (user) => {
    const body = await readJsonBody(request, MessageSchema);
    if (!body.ok) return body.response;
    const message = await sendTeamMessage(user.id, (await params).id, body.data.body);
    return NextResponse.json({ message }, { status: 201 });
  });
}
