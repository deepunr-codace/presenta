import { NextResponse } from "next/server";
import { CollabError } from "@/lib/collab-db";
import { listGoogleDriveBackups } from "@/lib/integrations/google-drive";
import { withUser } from "../../../_lib/guard";

export function GET() {
  return withUser("GET /api/integrations/google-drive/files", async (user) => {
    try { return NextResponse.json({ files: await listGoogleDriveBackups(user.id) }, { headers: { "Cache-Control": "private, no-store" } }); }
    catch (error) { if (error instanceof CollabError) return NextResponse.json({ error: error.message }, { status: error.status }); throw error; }
  });
}
