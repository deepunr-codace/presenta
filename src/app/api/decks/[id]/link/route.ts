import { NextResponse } from "next/server";
import { z } from "zod";
import { getLink, setLinkAccess } from "@/lib/collab-db";
import { bad, withUser } from "../../../_lib/guard";

type Ctx = { params: Promise<{ id: string }> };

/** The deck's share link and who it works for. Owner only. */
export function GET(_request: Request, { params }: Ctx) {
  return withUser("GET /api/decks/[id]/link", async (user) => {
    const link = await getLink(user.id, (await params).id);
    return NextResponse.json({ link: link ?? { access: "restricted", token: null } });
  });
}

const AccessSchema = z.object({ access: z.enum(["restricted", "anyone_view"]) });

/** `anyone_view`: any signed-in person with the link can view. `restricted`: the link stops working. */
export function PUT(request: Request, { params }: Ctx) {
  return withUser("PUT /api/decks/[id]/link", async (user) => {
    const parsed = AccessSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return bad("Invalid request.");
    return NextResponse.json({ link: await setLinkAccess(user.id, (await params).id, parsed.data.access) });
  });
}
