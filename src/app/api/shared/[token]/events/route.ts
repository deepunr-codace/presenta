import { NextResponse } from "next/server";
import { z } from "zod";
import { recordPublicEvent } from "@/lib/drive-db";
import { authorizePublicLink } from "@/lib/collab-db";
import { bad } from "../../../_lib/guard";

const Schema = z.object({ visitorId: z.string().regex(/^[0-9a-f-]{36}$/i), kind: z.enum(["view", "present"]) });

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token;
  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!(await authorizePublicLink(token, accessToken))) return NextResponse.json({ error: "This link is not active or needs its password." }, { status: 401 });
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return bad("Invalid analytics event.");
  const accepted = await recordPublicEvent(token, parsed.data.visitorId, parsed.data.kind);
  if (!accepted) return NextResponse.json({ error: "This link is not active." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
