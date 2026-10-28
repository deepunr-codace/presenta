import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Encryption at rest for secrets kept in the database (pooled AI keys). AES-256-GCM; the key is derived from
 * KEY_ENCRYPTION_SECRET, or AUTH_SECRET when that is not set. Changing the secret makes stored values unreadable,
 * so keys would have to be added again. Server only.
 */

function secretKey(): Buffer {
  const secret = process.env.KEY_ENCRYPTION_SECRET?.trim() || process.env.AUTH_SECRET?.trim();
  if (!secret) throw new Error("KEY_ENCRYPTION_SECRET (or AUTH_SECRET) is not set, so stored keys cannot be encrypted.");
  return createHash("sha256").update(secret).digest();
}

/** `iv.tag.ciphertext`, each base64. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
}

export function decryptSecret(stored: string): string {
  const [iv, tag, data] = stored.split(".").map((p) => Buffer.from(p, "base64"));
  if (!iv || !tag || !data) throw new Error("Stored secret is malformed.");
  const decipher = createDecipheriv("aes-256-gcm", secretKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
