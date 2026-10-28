import { NextResponse } from "next/server";
import { z } from "zod";
import { createFolder, listFolders } from "@/lib/drive-db";
import { bad, withUser } from "../_lib/guard";

/** All my folders as a flat list; the browser builds the tree from `parentId`. */
export function GET() {
  return withUser("GET /api/folders", async (user) => NextResponse.json({ folders: await listFolders(user.id) }));
}

const CreateSchema = z.object({ name: z.string(), parentId: z.string().min(1).nullable().optional() });

export function POST(request: Request) {
  return withUser("POST /api/folders", async (user) => {
    const parsed = CreateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return bad("Invalid request.");
    return NextResponse.json({ folder: await createFolder(user.id, parsed.data.name, parsed.data.parentId ?? null) });
  });
}
