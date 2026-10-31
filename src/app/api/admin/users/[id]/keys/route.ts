import { NextResponse } from "next/server";
import { z } from "zod";
import { adminUser } from "@/lib/admin-guard";
import { isPlausibleKey } from "@/lib/ai/auth";
import { listAssignedKeys, removeAssignedKey, setAssignedKey } from "@/lib/ai/user-keys-db";

/** Admin-only: the AI keys assigned to one user (hints only), set one, or remove one. */

type Ctx = { params: Promise<{ id: string }> };
const notAllowed = () => NextResponse.json({ error: "Not allowed." }, { status: 403 });
const Provider = z.enum(["openai", "anthropic", "gemini"]);

export async function GET(_request: Request, { params }: Ctx) {
  if (!(await adminUser())) return notAllowed();
  const { id } = await params;
  try {
    return NextResponse.json({ keys: await listAssignedKeys(id) });
  } catch (err) {
    console.error("GET /api/admin/users/[id]/keys failed", err);
    return NextResponse.json({ error: "Could not load the keys." }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: Ctx) {
  const admin = await adminUser();
  if (!admin) return notAllowed();
  const { id } = await params;
  const parsed = z.object({ provider: Provider, apiKey: z.string().trim() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  if (!isPlausibleKey(parsed.data.apiKey)) return NextResponse.json({ error: "That does not look like a valid API key." }, { status: 400 });
  try {
    await setAssignedKey(id, parsed.data.provider, parsed.data.apiKey, admin.email);
    return NextResponse.json({ keys: await listAssignedKeys(id) });
  } catch (err) {
    console.error("PUT /api/admin/users/[id]/keys failed", err);
    return NextResponse.json({ error: "Could not save the key." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  if (!(await adminUser())) return notAllowed();
  const { id } = await params;
  const parsed = z.object({ provider: Provider }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    await removeAssignedKey(id, parsed.data.provider);
    return NextResponse.json({ keys: await listAssignedKeys(id) });
  } catch (err) {
    console.error("DELETE /api/admin/users/[id]/keys failed", err);
    return NextResponse.json({ error: "Could not remove the key." }, { status: 500 });
  }
}
