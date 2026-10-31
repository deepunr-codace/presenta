import { resolveAiForRequest, smartPageLayout } from "@/lib/ai";
import { SmartPageRequestSchema } from "@/lib/import/smart-schema";
import { jsonFailure, jsonOk, readJsonBody } from "../../_lib/respond";

export const runtime = "nodejs";
/** One AI attempt may take up to 55 s plus one retry. */
export const maxDuration = 120;

/** Smart convert: one PDF page (its picture and text lines) laid out as editable elements. Uses one AI request. */
export async function POST(request: Request) {
  const body = await readJsonBody(request, SmartPageRequestSchema, 4 * 1024 * 1024);
  if (!body.ok) return body.response;
  try {
    const ai = await resolveAiForRequest(request, { cost: 1 });
    return jsonOk(await smartPageLayout(body.data, { signal: request.signal, ai }), ai.source);
  } catch (err) {
    return jsonFailure(err, "Smart convert could not read this page.");
  }
}
