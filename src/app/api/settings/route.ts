import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { BrandSchema, ThemeIdSchema } from "@/lib/deck/schema";
import { getSettings, saveSettings } from "@/lib/decks-db";

/** Per-account settings that follow the user across devices: the brand kit and starred decks. */

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  try {
    return NextResponse.json(await getSettings(session.user.id));
  } catch (err) {
    console.error("GET /api/settings failed", err);
    return NextResponse.json({ error: "Could not load your settings." }, { status: 500 });
  }
}

const PatchSchema = z.object({
  brandKit: z.object({ brand: BrandSchema, themeId: ThemeIdSchema.optional() }).nullable().optional(),
  starred: z.array(z.string().max(80)).max(1000).nullable().optional(),
});

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const parsed = PatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid settings." }, { status: 400 });

  try {
    await saveSettings(session.user.id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/settings failed", err);
    return NextResponse.json({ error: "Could not save your settings." }, { status: 500 });
  }
}
