import { CollabError } from "@/lib/collab-db";
import { exportGoogleSlidesPptx } from "@/lib/integrations/google-drive";
import { withUser } from "../../../_lib/guard";

export async function POST(request: Request) {
  return withUser("POST /api/integrations/google-drive/import-slides", async (user) => {
    let body: { fileId?: unknown };
    try {
      const bodyText = await request.text();
      if (new TextEncoder().encode(bodyText).byteLength > 4096) return Response.json({ error: "Invalid import request." }, { status: 413 });
      body = JSON.parse(bodyText) as { fileId?: unknown };
    } catch { return Response.json({ error: "Choose a Google Slides presentation." }, { status: 400 }); }
    const fileId = body.fileId;
    if (typeof fileId !== "string") return Response.json({ error: "Choose a Google Slides presentation." }, { status: 400 });
    try {
      const file = await exportGoogleSlidesPptx(user.id, fileId);
      return new Response(file.bytes, { headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        "Cache-Control": "private, no-store",
      } });
    } catch (error) {
      if (error instanceof CollabError) return Response.json({ error: error.message }, { status: error.status });
      throw error;
    }
  });
}
