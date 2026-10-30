import { NextResponse } from "next/server";
import { z } from "zod";
import { adminUser } from "@/lib/admin-guard";
import { addPoolKey, getPresentaSettings, listPoolKeys, savePresentaSettings, usageSummary } from "@/lib/ai/pool-db";
import { fetchKeyInfo } from "@/lib/ai/openrouter";

/** Admin-only management of Presenta Studio: the pooled OpenRouter keys, the model and the daily allowance. */

const notAllowed = () => NextResponse.json({ error: "Not allowed." }, { status: 403 });

export async function GET() {
  if (!(await adminUser())) return notAllowed();
  try {
    const [keys, settings, usage] = await Promise.all([listPoolKeys(), getPresentaSettings(), usageSummary()]);
    return NextResponse.json({ keys, settings, usage });
  } catch (err) {
    console.error("GET /api/admin/ai failed", err);
    return NextResponse.json({ error: "Could not load the AI settings." }, { status: 500 });
  }
}

const AddKeySchema = z.object({
  label: z.string().trim().min(1, "Give the key a name.").max(60),
  apiKey: z
    .string()
    .trim()
    .regex(/^sk-or-[A-Za-z0-9_-]{20,300}$/, "That does not look like an OpenRouter key (it starts with sk-or-)."),
});

/** Add a key to the pool. It is checked against OpenRouter first, then stored encrypted. */
export async function POST(request: Request) {
  if (!(await adminUser())) return notAllowed();
  const parsed = AddKeySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });

  const info = await fetchKeyInfo(parsed.data.apiKey);
  if (!info.ok) return NextResponse.json({ error: info.error ?? "That key was not accepted." }, { status: 400 });

  try {
    const id = await addPoolKey(parsed.data.label, parsed.data.apiKey);
    return NextResponse.json({ id });
  } catch (err) {
    console.error("POST /api/admin/ai failed", err);
    return NextResponse.json({ error: "Could not save the key." }, { status: 500 });
  }
}

const SettingsSchema = z.object({
  enabled: z.boolean().optional(),
  model: z.string().trim().min(3).max(120).regex(/^[A-Za-z0-9._:/-]+$/, "Use an OpenRouter model id such as openai/gpt-4o-mini.").optional(),
  dailyLimit: z.number().int().min(0).max(10_000).optional(),
});

export async function PUT(request: Request) {
  if (!(await adminUser())) return notAllowed();
  const parsed = SettingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid settings." }, { status: 400 });
  try {
    return NextResponse.json({ settings: await savePresentaSettings(parsed.data) });
  } catch (err) {
    console.error("PUT /api/admin/ai failed", err);
    return NextResponse.json({ error: "Could not save the settings." }, { status: 500 });
  }
}
