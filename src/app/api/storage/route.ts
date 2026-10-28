import { NextResponse } from "next/server";
import { getStorageUsage } from "@/lib/storage";
import { withUser } from "../_lib/guard";

/** How much of my storage is used: decks (trash included) and media. */
export function GET() {
  return withUser("GET /api/storage", async (user) => NextResponse.json(await getStorageUsage(user.id)));
}
