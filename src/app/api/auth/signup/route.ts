import { NextResponse } from "next/server";
import { z } from "zod";
import { EmailInUseError, createUser } from "@/lib/auth/users";

const SignupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(80),
  email: z.string().trim().email("Enter a valid email."),
  password: z.string().min(8, "Use at least 8 characters."),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = SignupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  try {
    const { name, email, password } = parsed.data;
    await createUser(name, email, password);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof EmailInUseError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not create the account. Try again." }, { status: 500 });
  }
}
