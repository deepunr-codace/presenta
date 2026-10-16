import { suggestAnswers } from "@/lib/ai";
import { SuggestRequestSchema } from "@/lib/deck/schema";
import { jsonFailure, jsonOk, readJsonBody } from "../_lib/respond";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await readJsonBody(request, SuggestRequestSchema);
  if (!body.ok) return body.response;

  try {
    return jsonOk(await suggestAnswers(body.data, { signal: request.signal }));
  } catch (err) {
    return jsonFailure(err, "Unexpected error while suggesting answers.");
  }
}
