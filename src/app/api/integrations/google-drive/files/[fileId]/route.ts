import { NextResponse } from "next/server";
import { CollabError } from "@/lib/collab-db";
import { readGoogleDriveBackup } from "@/lib/integrations/google-drive";
import { withUser } from "../../../../_lib/guard";

type Params = { params: Promise<{ fileId: string }> };

export function GET(_request: Request, { params }: Params) {
  return withUser("GET /api/integrations/google-drive/files/[fileId]", async (user) => {
    try { return NextResponse.json(await readGoogleDriveBackup(user.id, (await params).fileId), { headers: { "Cache-Control": "private, no-store" } }); }
    catch (error) { if (error instanceof CollabError) return NextResponse.json({ error: error.message }, { status: error.status }); throw error; }
  });
}
