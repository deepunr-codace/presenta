import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizePublicLink, castAudiencePollVote, CollabError, getPublicAudiencePoll } from "@/lib/collab-db";
import { bad } from "../../../_lib/guard";

type Params = { params: Promise<{ token: string }> };
const VoteSchema = z.object({ visitorId: z.string().regex(/^[0-9a-f-]{36}$/i), pollId: z.string().min(1).max(100), optionIndex: z.number().int().min(0).max(5) });

export async function GET(request: Request, { params }: Params) {
  const token = (await params).token;
  if (!(await authorizePublicLink(token, request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null))) return NextResponse.json({ error: "This link is not active or needs its password." }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  const visitorId = new URL(request.url).searchParams.get("visitorId") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(visitorId)) return bad("Refresh the page and try again.");
  try {
    const poll = await getPublicAudiencePoll(token, visitorId);
    return NextResponse.json({ poll }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof CollabError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}

export async function POST(request: Request, { params }: Params) {
  const token = (await params).token;
  if (!(await authorizePublicLink(token, request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null))) return NextResponse.json({ error: "This link is not active or needs its password." }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  const parsed = VoteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "Invalid vote.");
  try {
    const poll = await castAudiencePollVote(token, parsed.data.visitorId, parsed.data.pollId, parsed.data.optionIndex);
    return NextResponse.json({ poll }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof CollabError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
