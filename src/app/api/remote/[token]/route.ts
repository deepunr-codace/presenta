import { NextResponse } from "next/server";
import { z } from "zod";
import { getRemoteSession, setRemoteSlide } from "@/lib/remote-control";

export const runtime = "nodejs";
const TokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const CommandSchema = z.object({ slideIndex: z.number().int().min(0).max(99) });
type Context = { params: Promise<{ token: string }> };

function invalid() {
  return NextResponse.json({ error: "This remote-control link is invalid or expired." }, { status: 404, headers: { "Cache-Control": "no-store" } });
}

export async function GET(_request: Request, { params }: Context) {
  const token = TokenSchema.safeParse((await params).token);
  if (!token.success) return invalid();
  const state = await getRemoteSession(token.data);
  return state ? NextResponse.json(state, { headers: { "Cache-Control": "no-store" } }) : invalid();
}

export async function POST(request: Request, { params }: Context) {
  const token = TokenSchema.safeParse((await params).token);
  const command = CommandSchema.safeParse(await request.json().catch(() => null));
  if (!token.success || !command.success) return invalid();
  const state = await setRemoteSlide(token.data, command.data.slideIndex);
  return state ? NextResponse.json(state, { headers: { "Cache-Control": "no-store" } }) : invalid();
}
