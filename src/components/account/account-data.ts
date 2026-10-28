export type AccountProfile = {
  name: string | null;
  email: string;
  image: string | null;
  hasPassword: boolean;
  /** Listed in ADMIN_EMAILS: may manage Presenta AI. */
  isAdmin?: boolean;
};

export async function fetchAccount(): Promise<AccountProfile> {
  const res = await fetch("/api/account");
  if (!res.ok) throw new Error("Could not load your account.");
  return res.json() as Promise<AccountProfile>;
}
