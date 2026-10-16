import { NextResponse } from "next/server";
import type { z } from "zod";
import { AiError, aiSource } from "@/lib/ai";
import type { ApiErrorCode, ApiFail, ApiOk } from "@/lib/api-client";

/** Request bodies above this size are rejected with 413 before they are parsed. */
export const MAX_BODY_BYTES = 1024 * 1024;

export function jsonOk<T>(data: T): NextResponse<ApiOk<T>> {
  return NextResponse.json({ ok: true, data, source: aiSource() });
}

export function jsonError(status: number, code: ApiErrorCode, error: string): NextResponse<ApiFail> {
  return NextResponse.json({ ok: false, error, code }, { status });
}

type ParsedBody<T> = { ok: true; data: T } | { ok: false; response: NextResponse<ApiFail> };

/**
 * Read and validate a JSON request body. Fails with 413 when the body is
 * larger than `MAX_BODY_BYTES` and with 400 when it is not JSON or does not
 * match `schema`. The body itself is never logged.
 */
export async function readJsonBody<S extends z.ZodType>(request: Request, schema: S): Promise<ParsedBody<z.output<S>>> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return { ok: false, response: tooLarge() };

  const text = await request.text();
  if (exceedsUtf8Bytes(text, MAX_BODY_BYTES)) return { ok: false, response: tooLarge() };

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, response: jsonError(400, "invalid", "Request body must be JSON.") };
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`).join("; ");
    return { ok: false, response: jsonError(400, "invalid", `Invalid request: ${issues}`) };
  }
  return { ok: true, data: parsed.data };
}

/**
 * Whether `text` is longer than `limit` bytes in UTF-8, with two fast paths:
 * more code units than the limit is already too long, and a string that
 * cannot exceed the limit even at three bytes per code unit needs no
 * encoding. Only the band in between is actually encoded.
 */
export function exceedsUtf8Bytes(text: string, limit: number): boolean {
  if (text.length > limit) return true;
  if (text.length * 3 <= limit) return false;
  return new TextEncoder().encode(text).byteLength > limit;
}

function tooLarge(): NextResponse<ApiFail> {
  return jsonError(413, "too_large", `Request body is too large (limit ${MAX_BODY_BYTES / 1024 / 1024} MB).`);
}

/**
 * Map a failure from the AI layer to a response: `AiError` becomes 502 with
 * its user-facing message, anything else 500 with only the fallback text.
 * The underlying error is logged on the server and never sent to the client.
 */
export function jsonFailure(err: unknown, fallback: string): NextResponse<ApiFail> {
  if (err instanceof AiError) return jsonError(502, err.code, err.message);
  console.error(fallback, err);
  return jsonError(500, "api", fallback);
}
