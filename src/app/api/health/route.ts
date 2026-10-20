import { activeModel, resolveAi, serverKeyAllowed } from "@/lib/ai";
import { jsonOk } from "../_lib/respond";

export const runtime = "nodejs";

/** Which provider would serve this request (the visitor's key if sent, else the server's where allowed). */
export async function GET(request: Request) {
  const ai = resolveAi(request);
  return jsonOk({ hasKey: ai.source !== "mock", model: activeModel(ai.source), provider: ai.source, byok: Boolean(ai.auth), serverKey: serverKeyAllowed() }, ai.source);
}
