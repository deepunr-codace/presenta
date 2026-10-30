import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { CollabError } from "@/lib/collab-db";
import { StorageFullError } from "@/lib/storage";
import { TemplateError } from "@/lib/templates-db";

export type SignedInUser = { id: string; email: string };

/**
 * Run a handler for the signed-in user. Not signed in is 401; a `CollabError` (something the user can fix, such as
 * "only the owner can do that") becomes its own status and message; anything else is logged and answered with a generic 500.
 */
export async function withUser(label: string, fn: (user: SignedInUser) => Promise<Response>): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  try {
    return await fn({ id: session.user.id, email: session.user.email ?? "" });
  } catch (err) {
    if (err instanceof CollabError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof TemplateError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof StorageFullError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    console.error(`${label} failed`, err);
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}

export const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
