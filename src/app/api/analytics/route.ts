import { NextResponse } from "next/server";
import { getAnalytics } from "@/lib/drive-db";
import { getStorageUsage } from "@/lib/storage";
import { withUser } from "../_lib/guard";

/** Views and presentations of my decks over the last 7, 30 or 90 days, plus my storage. */
export function GET(request: Request) {
  return withUser("GET /api/analytics", async (user) => {
    const asked = Number(new URL(request.url).searchParams.get("days"));
    const days = [7, 30, 90].includes(asked) ? asked : 30;
    const [analytics, storage] = await Promise.all([getAnalytics(user.id, days), getStorageUsage(user.id)]);
    return NextResponse.json({ ...analytics, storage });
  });
}
