import { createHash } from "node:crypto";
import { auth } from "@/auth";
import { z } from "zod";
import { resolveAi, resolveAiForRequest } from "@/lib/ai";
import { jsonError, jsonFailure, jsonOk, readJsonBody } from "../../_lib/respond";

export const runtime = "nodejs";
export const maxDuration = 120;

const RequestSchema = z.object({
  prompt: z.string().trim().min(5).max(1200),
  size: z.enum(["1536x864", "864x1536", "1024x1024"]),
});

type OpenAiImageResponse = { data?: { b64_json?: string }[]; error?: { message?: string } };

export async function POST(request: Request) {
  const body = await readJsonBody(request, RequestSchema);
  if (!body.ok) return body.response;

  // The visitor's own key or one an admin assigned them; otherwise the server's key, for signed-in users only.
  const session = await auth();
  let ai = await resolveAiForRequest(request, { cost: 0 });
  if (ai.source !== "openai") {
    const server = resolveAi(request);
    if (server.source === "openai" && (server.auth || session?.user?.id)) ai = server;
  }
  if (ai.source !== "openai" || ai.auth?.provider === "anthropic" || ai.auth?.provider === "openrouter") {
    return jsonError(400, "auth", "Image generation requires an OpenAI API key. Add an OpenAI key in Settings to use this feature.");
  }
  const apiKey = ai.auth?.apiKey ?? process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return jsonError(400, "auth", "Image generation requires an OpenAI API key. Add an OpenAI key in Settings to use this feature.");

  try {
    const safetyIdentifier = session?.user?.id ? createHash("sha256").update(session.user.id).digest("hex") : undefined;
    const timeout = AbortSignal.timeout(105_000);
    const signal = typeof AbortSignal.any === "function" ? AbortSignal.any([request.signal, timeout]) : request.signal;
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-image-2.5-flare",
        prompt: `Create a polished, presentation-ready visual. ${body.data.prompt} Avoid lettering, logos and watermarks.`,
        size: body.data.size,
        quality: "medium",
        output_format: "webp",
        output_compression: 82,
        n: 1,
        ...(safetyIdentifier ? { safety_identifier: safetyIdentifier } : {}),
      }),
      signal,
    });
    const result = (await response.json().catch(() => null)) as OpenAiImageResponse | null;
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) return jsonError(502, "auth", "OpenAI rejected this key or does not have image generation enabled.");
      if (response.status === 429) return jsonError(429, "rate_limit", "OpenAI is rate-limited right now. Wait a moment and try again.");
      return jsonError(502, "api", `OpenAI could not generate this image (HTTP ${response.status}). Check your account access and prompt, then try again.`);
    }
    const image = result?.data?.[0]?.b64_json;
    if (!image) return jsonError(502, "api", "OpenAI returned no image. Please try again.");
    return jsonOk({ src: `data:image/webp;base64,${image}` }, ai.source);
  } catch (error) {
    if (error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError")) return jsonError(504, "network", "Image generation was cancelled or took too long.");
    return jsonFailure(error, "Could not reach OpenAI image generation.");
  }
}
