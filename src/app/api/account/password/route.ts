import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { changePassword, findUserById, WrongPasswordError } from "@/lib/auth/users";

const PasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, "Use at least 8 characters."),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const parsed = PasswordSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });

  const user = await findUserById(session.user.id);
  if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  try {
    await changePassword(user, parsed.data.newPassword, parsed.data.currentPassword);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof WrongPasswordError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: "Could not update the password." }, { status: 500 });
  }
}
