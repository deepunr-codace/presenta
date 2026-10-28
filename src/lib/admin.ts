/**
 * Who may manage the app (AI key pool, usage limits). A comma-separated list of emails in ADMIN_EMAILS;
 * when it is empty nobody is an admin. Compared case-insensitively.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.trim().toLowerCase());
}
