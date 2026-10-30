import { NextResponse } from "next/server";
import { z } from "zod";
import { addPublicAudienceQuestion, authorizePublicLink, CollabError, listPublicAudienceQuestions } from "@/lib/collab-db";
import { bad } from "../../../_lib/guard";

type Params = { params: Promise<{ token: string }> };
const Schema = z.object({ visitorId: z.string().regex(/^[0-9a-f-]{36}$/i), name: z.string().trim().max(80).optional(), body: z.string().trim().min(3).max(500), slideNumber: z.number().int().min(1).max(100).nullable().optional() });

export async function GET(_request: Request, { params }: Params) {
  const token = (await params).token;
  if (!(await authorizePublicLink(token, _request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null))) return NextResponse.json({ error: "This link is not active or needs its password." }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  const questions = await listPublicAudienceQuestions(token);
  if (!questions) return NextResponse.json({ error: "This share link is not active." }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  return NextResponse.json({ questions }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request, { params }: Params) {
  const token = (await params).token;
  if (!(await authorizePublicLink(token, request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null))) return NextResponse.json({ error: "This link is not active or needs its password." }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "Invalid question.");
  try {
    await addPublicAudienceQuestion(token, parsed.data.visitorId, parsed.data.name ?? "", parsed.data.body, parsed.data.slideNumber ?? null);
    const questions = await listPublicAudienceQuestions(token);
    if (!questions) return NextResponse.json({ error: "This share link is not active." }, { status: 404 });
    return NextResponse.json({ questions }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof CollabError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
