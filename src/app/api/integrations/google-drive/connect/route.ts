import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CollabError } from "@/lib/collab-db";
import { googleDriveAuthorizationUrl, newGoogleDriveState } from "@/lib/integrations/google-drive";
import { withUser } from "../../../_lib/guard";

const STATE_COOKIE = "presenta_google_drive_oauth_state";

export function GET(request: Request) {
  return withUser("GET /api/integrations/google-drive/connect", async () => {
    try {
      const state = newGoogleDriveState();
      const secure = new URL(request.url).protocol === "https:";
      (await cookies()).set(STATE_COOKIE, state, { httpOnly: true, sameSite: "lax", secure, path: "/api/integrations/google-drive/callback", maxAge: 600 });
      return NextResponse.redirect(googleDriveAuthorizationUrl(new URL(request.url).origin, state));
    } catch (error) {
      if (error instanceof CollabError) return NextResponse.json({ error: error.message }, { status: error.status });
      throw error;
    }
  });
}
