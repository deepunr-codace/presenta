import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";

/** The signed-in admin, or null for everyone else (signed out, or not listed in ADMIN_EMAILS). Server only. */
export async function adminUser(): Promise<{ id: string; email: string } | null> {
  const session = await auth();
  const email = session?.user?.email;
  if (!session?.user?.id || !email || !isAdminEmail(email)) return null;
  return { id: session.user.id, email };
}
