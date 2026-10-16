import { activeModel, aiSource, hasAiKey } from "@/lib/ai";
import { jsonOk } from "../_lib/respond";

export const runtime = "nodejs";

export async function GET() {
  return jsonOk({ hasKey: hasAiKey(), model: activeModel(), provider: aiSource() });
}
