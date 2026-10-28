import { NextResponse } from "next/server";
import { claimLink } from "@/lib/collab-db";
import { withUser } from "../../_lib/guard";

/** Open a share link. Works only for a signed-in person, and only while the owner has the link set to "anyone can view". */
export function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  return withUser("POST /api/shared/[token]", async (user) => NextResponse.json(await claimLink(user.id, (await params).token)));
}
