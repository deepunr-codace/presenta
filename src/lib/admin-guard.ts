import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { findUserById } from "@/lib/auth/users";

/** The signed-in admin, or null for everyone else (signed out, or not listed in ADMIN_EMAILS). Server only. */
export async function adminUser(): Promise<{ id: string; email: string } | null> {
  const session = await auth();
  const email = session?.user?.email;
  if (!session?.user?.id || !email || !isAdminEmail(email)) return null;
  // Admin rights need an address proven by a Google sign-in, not one typed into the sign-up form.
  const row = await findUserById(session.user.id).catch(() => null);
  if (!row?.emailVerified || row.email.toLowerCase() !== email.toLowerCase()) return null;
  return { id: session.user.id, email };
}
