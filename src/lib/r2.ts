import { DeleteObjectsCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/** Cloudflare R2 (S3-compatible) client. Server only: reads secrets from the environment on first use. */

let client: S3Client | null = null;

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set. Add the R2 settings to .env.local (see .env.example).`);
  return v;
}

function r2(): S3Client {
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${env("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: env("R2_ACCESS_KEY_ID"), secretAccessKey: env("R2_SECRET_ACCESS_KEY") },
      // Browsers cannot send the default CRC32 checksum header, so only sign what is required.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  return client;
}

/** Public URL of an object (the bucket's r2.dev or custom domain). */
export function publicUrl(key: string): string {
  return `${env("R2_PUBLIC_URL").replace(/\/+$/, "")}/${key}`;
}

/** A short-lived URL the browser can PUT a file to directly. The size and type are part of the signature. */
export function presignUpload(key: string, contentType: string, contentLength: number): Promise<string> {
  const command = new PutObjectCommand({ Bucket: env("R2_BUCKET"), Key: key, ContentType: contentType, ContentLength: contentLength });
  return getSignedUrl(r2(), command, { expiresIn: 600 });
}

export async function deleteObjects(keys: string[]): Promise<void> {
  const objects = keys.filter(Boolean).map((Key) => ({ Key }));
  if (!objects.length) return;
  await r2().send(new DeleteObjectsCommand({ Bucket: env("R2_BUCKET"), Delete: { Objects: objects, Quiet: true } }));
}
