import { NextResponse } from "next/server";
import { adminUser } from "@/lib/admin-guard";
import { listUsersWithUsage } from "@/lib/admin-users-db";
import { STORAGE_LIMIT_BYTES } from "@/lib/storage";

/** Admin-only: every account with its stored decks and media, AI requests and deck activity. */
export async function GET() {
  if (!(await adminUser())) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  try {
    return NextResponse.json({ users: await listUsersWithUsage(), storageLimit: STORAGE_LIMIT_BYTES });
  } catch (err) {
    console.error("GET /api/admin/users failed", err);
    return NextResponse.json({ error: "Could not load the users." }, { status: 500 });
  }
}
