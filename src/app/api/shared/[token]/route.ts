import { NextResponse } from "next/server";
import { authorizePublicLink, claimLink, getPublicDeckByToken, publicLinkNeedsPassword } from "@/lib/collab-db";
import { withUser } from "../../_lib/guard";

/** Open a share link. Works only for a signed-in person, and only while the owner has the link set to "anyone can view". */
export function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  return withUser("POST /api/shared/[token]", async (user) => NextResponse.json(await claimLink(user.id, (await params).token, request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null)));
}

/** Public, read-only access through the unguessable share token. The database query rechecks that the link is active. */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token;
  const needsPassword = await publicLinkNeedsPassword(token);
  if (needsPassword === null) return NextResponse.json({ error: "This link is not active." }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  const allowed = await authorizePublicLink(token, _request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null);
  if (!allowed) return NextResponse.json({ passwordRequired: true }, { headers: { "Cache-Control": "private, no-store" } });
  const deck = await getPublicDeckByToken(token);
  if (!deck) return NextResponse.json({ error: "This link is not active." }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  return NextResponse.json({ deck }, { headers: { "Cache-Control": "private, no-store" } });
}
