import { NextResponse } from "next/server";
import { z } from "zod";
import { adminUser } from "@/lib/admin-guard";
import { fetchKeyInfo } from "@/lib/ai/openrouter";
import { deletePoolKey, getPoolKeySecret, updatePoolKey } from "@/lib/ai/pool-db";

type Ctx = { params: Promise<{ id: string }> };

const notAllowed = () => NextResponse.json({ error: "Not allowed." }, { status: 403 });

const PatchSchema = z.object({ label: z.string().trim().min(1).max(60).optional(), enabled: z.boolean().optional() });

/** Rename a key, or switch it on or off. Switching on also ends any rest period. */
export async function PATCH(request: Request, { params }: Ctx) {
  if (!(await adminUser())) return notAllowed();
  const { id } = await params;
  const parsed = PatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    if (!(await updatePoolKey(id, parsed.data))) return NextResponse.json({ error: "That key was not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/admin/ai/keys failed", err);
    return NextResponse.json({ error: "Could not update the key." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  if (!(await adminUser())) return notAllowed();
  const { id } = await params;
  try {
    await deletePoolKey(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/admin/ai/keys failed", err);
    return NextResponse.json({ error: "Could not delete the key." }, { status: 500 });
  }
}

/** Ask OpenRouter about this key (credit used and left). The key itself is never sent to the browser. */
export async function POST(_request: Request, { params }: Ctx) {
  if (!(await adminUser())) return notAllowed();
  const { id } = await params;
  try {
    const secret = await getPoolKeySecret(id);
    if (!secret) return NextResponse.json({ error: "That key was not found." }, { status: 404 });
    return NextResponse.json({ info: await fetchKeyInfo(secret) });
  } catch (err) {
    console.error("POST /api/admin/ai/keys failed", err);
    return NextResponse.json({ error: "Could not check the key." }, { status: 500 });
  }
}
