import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_TTL_SECONDS = 12 * 60 * 60;

function signingKey(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET must contain at least 32 characters to sign shared-link access.");
  return secret;
}

function signature(value: string): string {
  return createHmac("sha256", signingKey()).update(value).digest("base64url");
}

export function signShareAccess(linkToken: string, passwordVersion: number): string {
  const payload = Buffer.from(JSON.stringify({ linkToken, passwordVersion, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifyShareAccess(accessToken: string | null, linkToken: string, passwordVersion: number): boolean {
  if (!accessToken) return false;
  const [payload, supplied, extra] = accessToken.split(".");
  if (!payload || !supplied || extra) return false;
  let expected: string;
  try { expected = signature(payload); } catch { return false; }
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { linkToken?: unknown; passwordVersion?: unknown; exp?: unknown };
    return parsed.linkToken === linkToken && parsed.passwordVersion === passwordVersion && typeof parsed.exp === "number" && parsed.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}
