import { NextResponse } from "next/server";
import { CollabError } from "@/lib/collab-db";
import { googleDrivePickerConfig } from "@/lib/integrations/google-drive";
import { withUser } from "../../../_lib/guard";

export function GET() {
  return withUser("GET /api/integrations/google-drive/picker-config", async (user) => {
    try {
      return NextResponse.json(await googleDrivePickerConfig(user.id), { headers: { "Cache-Control": "private, no-store" } });
    } catch (error) {
      if (error instanceof CollabError) return NextResponse.json({ error: error.message }, { status: error.status });
      throw error;
    }
  });
}
