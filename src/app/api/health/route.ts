import { activeModel, presentaQuota, resolveAiForRequest, serverKeyAllowed } from "@/lib/ai";
import { jsonOk } from "../_lib/respond";

export const runtime = "nodejs";

/**
 * Which provider would serve this request: the visitor's own key if sent, else Presenta Studio for a signed-in user
 * (with today's allowance), else the server's own key where allowed. Checking does not use any allowance.
 */
export async function GET(request: Request) {
  const ai = await resolveAiForRequest(request, { cost: 0 });
  const quota = ai.presenta ? await presentaQuota(ai.presenta.userId).catch(() => null) : null;
  return jsonOk(
    {
      hasKey: ai.source !== "mock",
      model: activeModel(ai.source),
      provider: ai.source,
      byok: Boolean(ai.auth),
      serverKey: serverKeyAllowed() || ai.source === "presenta",
      ...(quota ? { quota } : {}),
    },
    ai.source,
  );
}
