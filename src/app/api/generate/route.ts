import { generateDeck } from "@/lib/ai";
import { GenerateRequestSchema } from "@/lib/deck/schema";
import { jsonFailure, jsonOk, readJsonBody } from "../_lib/respond";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await readJsonBody(request, GenerateRequestSchema);
  if (!body.ok) return body.response;

  try {
    return jsonOk(await generateDeck(body.data, { signal: request.signal }));
  } catch (err) {
    return jsonFailure(err, "Unexpected error while generating the deck.");
  }
}
