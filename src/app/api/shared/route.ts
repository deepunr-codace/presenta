import { NextResponse } from "next/server";
import { listSharedWithMe } from "@/lib/collab-db";
import { withUser } from "../_lib/guard";

/** Decks shared with me, directly, through a team, or through a link I opened. */
export function GET() {
  return withUser("GET /api/shared", async (user) => NextResponse.json({ decks: await listSharedWithMe(user.id) }));
}
