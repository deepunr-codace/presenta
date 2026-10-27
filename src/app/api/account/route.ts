import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { deleteUserById, findUserById, updateUserName } from "@/lib/auth/users";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const user = await findUserById(session.user.id);
  if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  return NextResponse.json({
    name: user.name,
    email: user.email,
    image: user.image,
    hasPassword: Boolean(user.passwordHash),
  });
}

const UpdateSchema = z.object({ name: z.string().trim().min(1, "Enter your name.").max(80) });

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const parsed = UpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });

  await updateUserName(session.user.id, parsed.data.name);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  await deleteUserById(session.user.id);
  return NextResponse.json({ ok: true });
}
