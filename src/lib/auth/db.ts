import { neon } from "@neondatabase/serverless";

/**
 * Lazy, memoised Neon/Vercel Postgres client. Not called at module load so
 * importing this file never requires POSTGRES_URL to be set (e.g. in tests).
 */
function connectionString(): string {
  const url = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("POSTGRES_URL is not set. Add a Postgres database (e.g. the Vercel Postgres / Neon integration) and set it in .env.local.");
  }
  return url;
}

let sqlClient: ReturnType<typeof neon> | null = null;

export function sql(): ReturnType<typeof neon> {
  if (!sqlClient) sqlClient = neon(connectionString());
  return sqlClient;
}

let ensured: Promise<void> | null = null;

/** Creates the `users` table on first use. Safe to call repeatedly. */
export function ensureUsersTable(): Promise<void> {
  if (!ensured) {
    const db = sql();
    ensured = db`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        image TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `
      .then(() => db`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ`)
      // Accounts without a password can only have come from Google, which proved the address.
      .then(() => db`UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL AND password_hash IS NULL`)
      .then(() => undefined);
    ensured.catch(() => (ensured = null));
  }
  return ensured;
}
