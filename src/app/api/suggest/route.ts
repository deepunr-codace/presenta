import { suggestAnswers, resolveAi } from "@/lib/ai";
import { SuggestRequestSchema } from "@/lib/deck/schema";
import { jsonFailure, jsonOk, readJsonBody } from "../_lib/respond";

export const runtime = "nodejs";
/** Vercel function limit; one AI attempt may take up to 55 s plus one retry. */
export const maxDuration = 120;

export async function POST(request: Request) {
  const body = await readJsonBody(request, SuggestRequestSchema);
  if (!body.ok) return body.response;

  const ai = resolveAi(request);
  try {
    return jsonOk(await suggestAnswers(body.data, { signal: request.signal, ai }), ai.source);
  } catch (err) {
    return jsonFailure(err, "Unexpected error while suggesting answers.");
  }
}
