import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { CollabError } from "@/lib/collab-db";
import { exchangeGoogleDriveCode, saveGoogleDriveCredentials } from "@/lib/integrations/google-drive";

const STATE_COOKIE = "presenta_google_drive_oauth_state";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const destination = new URL("/integrations", url.origin);
  const cookieStore = await cookies();
  const savedState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);
  const session = await auth();
  if (!session?.user?.id) {
    destination.searchParams.set("drive", "signin-required");
    return NextResponse.redirect(destination);
  }
  if (url.searchParams.has("error")) {
    destination.searchParams.set("drive", "cancelled");
    return NextResponse.redirect(destination);
  }
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  if (!state || !savedState || state !== savedState || !code) {
    destination.searchParams.set("drive", "invalid-state");
    return NextResponse.redirect(destination);
  }
  try {
    const credentials = await exchangeGoogleDriveCode(code, url.origin);
    await saveGoogleDriveCredentials(session.user.id, credentials);
    destination.searchParams.set("drive", "connected");
  } catch (error) {
    destination.searchParams.set("drive", "failed");
    destination.searchParams.set("drive_error", error instanceof CollabError ? error.message : "Could not connect Google Drive.");
  }
  return NextResponse.redirect(destination);
}
