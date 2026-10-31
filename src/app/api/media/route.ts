import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { newId } from "@/lib/deck/ids";
import {
  MEDIA_IMAGE_MAX_BYTES,
  MEDIA_IMAGE_TYPES,
  MEDIA_THUMB_MAX_BYTES,
  MEDIA_VIDEO_MAX_BYTES,
  MEDIA_VIDEO_TYPES,
  insertMediaRow,
  listMediaRows,
  type MediaRow,
} from "@/lib/media-db";
import { presignUpload, publicUrl } from "@/lib/r2";
import { assertRoom, StorageFullError } from "@/lib/storage";

/** What the browser needs to show an item: the row plus its public URLs. */
function toItem(row: MediaRow) {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    mime: row.mime,
    bytes: Number(row.bytes),
    width: row.width,
    height: row.height,
    duration: row.duration,
    addedAt: new Date(row.created_at).toISOString(),
    url: publicUrl(row.key),
    thumb: publicUrl(row.thumb_key),
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    return NextResponse.json({ items: (await listMediaRows(session.user.id)).map(toItem) });
  } catch {
    return NextResponse.json({ error: "Could not load the media library." }, { status: 500 });
  }
}

const CreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  mime: z.string(),
  bytes: z.number().int().positive(),
  width: z.number().int().min(1).max(20000),
  height: z.number().int().min(1).max(20000),
  duration: z.number().min(0).max(24 * 3600).nullable().optional(),
  thumbMime: z.enum(["image/jpeg", "image/png"]),
  thumbBytes: z.number().int().positive().max(MEDIA_THUMB_MAX_BYTES),
  /** "deck": a picture moved out of a saved deck. It is stored like any upload but not listed in the library. */
  source: z.enum(["library", "deck"]).optional(),
});

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

/**
 * Registers a new library item and returns presigned URLs. The browser then uploads the file and its thumbnail
 * straight to R2, so large videos never pass through this function.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const parsed = CreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  const body = parsed.data;

  const isImage = (MEDIA_IMAGE_TYPES as readonly string[]).includes(body.mime);
  const isVideo = (MEDIA_VIDEO_TYPES as readonly string[]).includes(body.mime);
  if (!isImage && !isVideo) return NextResponse.json({ error: "Upload a PNG, JPG, WebP, GIF, SVG, MP4 or WebM file." }, { status: 400 });
  const max = isVideo ? MEDIA_VIDEO_MAX_BYTES : MEDIA_IMAGE_MAX_BYTES;
  if (body.bytes > max) return NextResponse.json({ error: `That file is too large; the limit is ${Math.round(max / 1024 / 1024)} MB.` }, { status: 413 });

  try {
    await assertRoom(session.user.id, body.bytes + body.thumbBytes);
    const id = newId("media");
    const userId = session.user.id;
    const key = `u/${userId}/${id}.${EXT[body.mime]}`;
    const thumbKey = `u/${userId}/${id}.thumb.${body.thumbMime === "image/png" ? "png" : "jpg"}`;

    const [uploadUrl, thumbUploadUrl] = await Promise.all([presignUpload(key, body.mime, body.bytes), presignUpload(thumbKey, body.thumbMime, body.thumbBytes)]);
    const row: Omit<MediaRow, "created_at"> = {
      id,
      user_id: userId,
      name: body.name,
      kind: isVideo ? "video" : "image",
      mime: body.mime,
      bytes: body.bytes,
      width: body.width,
      height: body.height,
      duration: isVideo ? (body.duration ?? null) : null,
      key,
      thumb_key: thumbKey,
      source: body.source ?? "library",
    };
    await insertMediaRow(row);
    return NextResponse.json({ item: toItem({ ...row, created_at: new Date().toISOString() }), uploadUrl, thumbUploadUrl });
  } catch (err) {
    if (err instanceof StorageFullError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    return NextResponse.json({ error: "Could not start the upload. Try again." }, { status: 500 });
  }
}
