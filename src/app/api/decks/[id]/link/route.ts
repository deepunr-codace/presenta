import { NextResponse } from "next/server";
import { z } from "zod";
import { getLink, setLinkAccess, setLinkExpiry, setLinkPassword } from "@/lib/collab-db";
import { bad, withUser } from "../../../_lib/guard";

type Ctx = { params: Promise<{ id: string }> };

/** The deck's share link and who it works for. Owner only. */
export function GET(_request: Request, { params }: Ctx) {
  return withUser("GET /api/decks/[id]/link", async (user) => {
    const link = await getLink(user.id, (await params).id);
    return NextResponse.json({ link: link ?? { access: "restricted", token: null, expiresAt: null, passwordEnabled: false } });
  });
}

const AccessSchema = z.object({
  access: z.enum(["restricted", "anyone_view"]).optional(),
  expiresInHours: z.union([z.literal(24), z.literal(168), z.literal(720), z.null()]).optional(),
  password: z.union([z.string().min(8).max(72), z.null()]).optional(),
}).refine((value) => value.access !== undefined || value.expiresInHours !== undefined || value.password !== undefined);

/** `anyone_view`: any signed-in person with the link can view. `restricted`: the link stops working. */
export function PUT(request: Request, { params }: Ctx) {
  return withUser("PUT /api/decks/[id]/link", async (user) => {
    const parsed = AccessSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return bad("Invalid request.");
    const deckId = (await params).id;
    if (parsed.data.password !== undefined) return NextResponse.json({ link: await setLinkPassword(user.id, deckId, parsed.data.password) });
    if (parsed.data.expiresInHours !== undefined) return NextResponse.json({ link: await setLinkExpiry(user.id, deckId, parsed.data.expiresInHours) });
    return NextResponse.json({ link: await setLinkAccess(user.id, deckId, parsed.data.access!) });
  });
}
