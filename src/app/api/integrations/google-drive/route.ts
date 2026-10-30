import { NextResponse } from "next/server";
import { CollabError } from "@/lib/collab-db";
import { disconnectGoogleDrive, hasGoogleDriveConnection } from "@/lib/integrations/google-drive";
import { withUser } from "../../_lib/guard";

export function GET() {
  return withUser("GET /api/integrations/google-drive", async (user) => NextResponse.json({ connected: await hasGoogleDriveConnection(user.id) }));
}

export function DELETE() {
  return withUser("DELETE /api/integrations/google-drive", async (user) => {
    try { await disconnectGoogleDrive(user.id); return NextResponse.json({ connected: false }); }
    catch (error) { if (error instanceof CollabError) return NextResponse.json({ error: error.message }, { status: error.status }); throw error; }
  });
}
