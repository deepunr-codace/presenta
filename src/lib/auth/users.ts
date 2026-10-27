import bcrypt from "bcryptjs";
import { newId } from "@/lib/deck/ids";
import { ensureUsersTable, sql } from "./db";

export type UserRecord = {
  id: string;
  name: string | null;
  email: string;
  passwordHash: string | null;
  image: string | null;
};

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  password_hash: string | null;
  image: string | null;
};

function fromRow(row: UserRow): UserRecord {
  return { id: row.id, name: row.name, email: row.email, passwordHash: row.password_hash, image: row.image };
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  await ensureUsersTable();
  const rows = (await sql()`SELECT * FROM users WHERE email = ${email.toLowerCase()} LIMIT 1`) as UserRow[];
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  await ensureUsersTable();
  const rows = (await sql()`SELECT * FROM users WHERE id = ${id} LIMIT 1`) as UserRow[];
  return rows[0] ? fromRow(rows[0]) : null;
}

export class EmailInUseError extends Error {
  constructor() {
    super("An account with that email already exists.");
    this.name = "EmailInUseError";
  }
}

/** Creates a new credentials user with a bcrypt-hashed password. */
export async function createUser(name: string, email: string, password: string): Promise<UserRecord> {
  await ensureUsersTable();
  const normalizedEmail = email.toLowerCase();
  if (await findUserByEmail(normalizedEmail)) throw new EmailInUseError();
  const passwordHash = await bcrypt.hash(password, 12);
  const id = newId("user");
  await sql()`INSERT INTO users (id, name, email, password_hash) VALUES (${id}, ${name}, ${normalizedEmail}, ${passwordHash})`;
  return { id, name, email: normalizedEmail, passwordHash, image: null };
}

export async function verifyPassword(user: UserRecord, password: string): Promise<boolean> {
  if (!user.passwordHash) return false;
  return bcrypt.compare(password, user.passwordHash);
}

/** Finds or creates a user for an OAuth sign-in (no password). Updates name/image if they changed. */
export async function upsertOAuthUser(email: string, name: string | null, image: string | null): Promise<UserRecord> {
  await ensureUsersTable();
  const normalizedEmail = email.toLowerCase();
  const existing = await findUserByEmail(normalizedEmail);
  if (existing) {
    await sql()`UPDATE users SET name = COALESCE(${name}, name), image = COALESCE(${image}, image) WHERE id = ${existing.id}`;
    return { ...existing, name: name ?? existing.name, image: image ?? existing.image };
  }
  const id = newId("user");
  await sql()`INSERT INTO users (id, name, email, image) VALUES (${id}, ${name}, ${normalizedEmail}, ${image})`;
  return { id, name, email: normalizedEmail, passwordHash: null, image };
}

export async function updateUserName(id: string, name: string): Promise<void> {
  await ensureUsersTable();
  await sql()`UPDATE users SET name = ${name} WHERE id = ${id}`;
}

export class WrongPasswordError extends Error {
  constructor() {
    super("That current password is wrong.");
    this.name = "WrongPasswordError";
  }
}

/**
 * Sets a new password. If the user already has one, `currentPassword` must
 * match it first; OAuth-only users (no password yet) can set one directly.
 */
export async function changePassword(user: UserRecord, newPassword: string, currentPassword?: string): Promise<void> {
  if (user.passwordHash) {
    if (!currentPassword || !(await verifyPassword(user, currentPassword))) throw new WrongPasswordError();
  }
  await ensureUsersTable();
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await sql()`UPDATE users SET password_hash = ${passwordHash} WHERE id = ${user.id}`;
}

export async function deleteUserById(id: string): Promise<void> {
  await ensureUsersTable();
  await sql()`DELETE FROM users WHERE id = ${id}`;
}
