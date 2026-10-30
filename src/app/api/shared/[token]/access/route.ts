import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticatePublicLink } from "@/lib/collab-db";

const Schema = z.object({ password: z.string().min(1).max(72) });

/** Verify a share password and issue a short-lived, link-scoped access token. */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter the share password." }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
  if (Buffer.byteLength(parsed.data.password, "utf8") > 72) return NextResponse.json({ error: "That password is too long." }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
  const accessToken = await authenticatePublicLink((await params).token, parsed.data.password);
  if (!accessToken) return NextResponse.json({ error: "That password is incorrect, or the link has expired." }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  return NextResponse.json({ accessToken }, { headers: { "Cache-Control": "private, no-store" } });
}
