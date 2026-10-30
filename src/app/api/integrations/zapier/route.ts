import { NextResponse } from "next/server";
import { z } from "zod";
import { hasZapierHook, setZapierHook } from "@/lib/integrations/slack";
import { withUser } from "../../_lib/guard";

const Schema = z.object({ webhookUrl: z.string().trim().max(1000).nullable() });

export function GET() {
  return withUser("GET /api/integrations/zapier", async (user) => NextResponse.json({ connected: await hasZapierHook(user.id) }));
}

export function PUT(request: Request) {
  return withUser("PUT /api/integrations/zapier", async (user) => {
    const parsed = Schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid webhook URL." }, { status: 400 });
    await setZapierHook(user.id, parsed.data.webhookUrl);
    return NextResponse.json({ connected: parsed.data.webhookUrl !== null });
  });
}
