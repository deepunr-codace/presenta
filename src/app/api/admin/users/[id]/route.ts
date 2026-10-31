import { NextResponse } from "next/server";
import { adminUser } from "@/lib/admin-guard";
import { userUsageDetail } from "@/lib/admin-users-db";

/** Admin-only: one account's decks and its AI requests per day. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await adminUser())) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const { id } = await params;
  try {
    return NextResponse.json(await userUsageDetail(id));
  } catch (err) {
    console.error("GET /api/admin/users/[id] failed", err);
    return NextResponse.json({ error: "Could not load this user." }, { status: 500 });
  }
}
