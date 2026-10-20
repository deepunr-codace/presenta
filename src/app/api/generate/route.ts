import { generateDeck, resolveAi } from "@/lib/ai";
import { GenerateRequestSchema } from "@/lib/deck/schema";
import { jsonFailure, jsonOk, readJsonBody } from "../_lib/respond";

export const runtime = "nodejs";
/** Vercel function limit; one AI attempt may take up to 55 s plus one retry. */
export const maxDuration = 120;

export async function POST(request: Request) {
  const body = await readJsonBody(request, GenerateRequestSchema);
  if (!body.ok) return body.response;

  const ai = resolveAi(request);
  try {
    return jsonOk(await generateDeck(body.data, { signal: request.signal, ai }), ai.source);
  } catch (err) {
    return jsonFailure(err, "Unexpected error while generating the deck.");
  }
}
