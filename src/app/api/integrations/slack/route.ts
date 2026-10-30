import { NextResponse } from "next/server";
import { z } from "zod";
import { CollabError } from "@/lib/collab-db";
import { hasSlackWebhook, setSlackWebhook } from "@/lib/integrations/slack";
import { bad, withUser } from "../../_lib/guard";

const Schema = z.object({ webhookUrl: z.string().trim().max(1000).nullable() });

export function GET() {
  return withUser("GET /api/integrations/slack", async (user) => NextResponse.json({ connected: await hasSlackWebhook(user.id) }));
}

export function PUT(request: Request) {
  return withUser("PUT /api/integrations/slack", async (user) => {
    const parsed = Schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "Invalid webhook URL.");
    try {
      await setSlackWebhook(user.id, parsed.data.webhookUrl);
      return NextResponse.json({ connected: parsed.data.webhookUrl !== null });
    } catch (error) {
      if (error instanceof CollabError) return NextResponse.json({ error: error.message }, { status: error.status });
      throw error;
    }
  });
}
