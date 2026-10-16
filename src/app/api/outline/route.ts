import { buildOutline } from "@/lib/ai";
import { OutlineRequestSchema } from "@/lib/deck/schema";
import { jsonError, jsonFailure, jsonOk, readJsonBody } from "../_lib/respond";

export const runtime = "nodejs";
/** Vercel function limit; one AI attempt may take up to 55 s plus one retry. */
export const maxDuration = 120;

export async function POST(request: Request) {
  const body = await readJsonBody(request, OutlineRequestSchema);
  if (!body.ok) return body.response;
  if (body.data.mode === "paste" && !body.data.brief.source?.trim()) {
    return jsonError(400, "invalid", "Paste mode needs brief.source with the pasted material.");
  }

  try {
    return jsonOk(await buildOutline(body.data, { signal: request.signal }));
  } catch (err) {
    return jsonFailure(err, "Unexpected error while building the outline.");
  }
}
