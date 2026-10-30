import { z } from "zod";
import { AiError, resolveAiForRequest } from "@/lib/ai";
import { jsonError, jsonFailure, jsonOk, readJsonBody } from "../_lib/respond";

export const runtime = "nodejs";
export const maxDuration = 120;

const RequestSchema = z.object({ query: z.string().trim().min(1).max(2000) });
const SourceSchema = z.object({ title: z.string().max(240), url: z.string().url().max(2000) });
const ResultSchema = z.object({ summary: z.string().min(1).max(12000), sources: z.array(SourceSchema).max(12) });
type ResearchSource = z.infer<typeof SourceSchema>;

function cleanSources(values: ResearchSource[]): ResearchSource[] {
  const seen = new Set<string>();
  return values.filter((source) => {
    try {
      const url = new URL(source.url);
      if (url.protocol !== "https:" || seen.has(url.href)) return false;
      seen.add(url.href);
      return true;
    } catch { return false; }
  }).slice(0, 8);
}

export async function POST(request: Request) {
  const body = await readJsonBody(request, RequestSchema);
  if (!body.ok) return body.response;
  try {
    const ai = await resolveAiForRequest(request, { cost: 0 });
    if (ai.source === "presenta") return jsonError(400, "invalid", "Web research is not available with the pooled Presenta Studio model yet. Add an OpenAI or Anthropic key in Settings to use Agent research.");
    if (ai.source === "mock") return jsonError(400, "auth", "Add an OpenAI or Anthropic API key in Settings to use Agent web research.");
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(90_000)]);
    if (ai.source === "openai") {
      const apiKey = ai.auth?.apiKey ?? process.env.OPENAI_API_KEY?.trim();
      if (!apiKey) throw new AiError("auth", "No OpenAI API key is available. Add your key in Settings.");
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST", signal,
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: "gpt-5.5", tools: [{ type: "web_search", search_context_size: "medium" }], input: `Research this presentation request using current, reliable web sources. Write a concise, factual research brief with key findings and caveats. Cite findings inline in the text and use only sources returned by web search. Request: ${body.data.query}` }),
      });
      if (!response.ok) throw new AiError(response.status === 401 || response.status === 403 ? "auth" : response.status === 429 ? "rate_limit" : "api", `OpenAI web research failed (HTTP ${response.status}).`, response.status);
      const data = await response.json() as { output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string; annotations?: Array<{ type?: string; url?: string; title?: string }> }> }> };
      const blocks = (data.output ?? []).flatMap((item) => item.type === "message" ? item.content ?? [] : []);
      const summary = blocks.filter((block) => block.type === "output_text" || block.type === "text").map((block) => block.text ?? "").join("\n").trim();
      const sources = cleanSources(blocks.flatMap((block) => (block.annotations ?? []).filter((annotation) => annotation.type === "url_citation" && annotation.url).map((annotation) => ({ title: annotation.title ?? new URL(annotation.url!).hostname, url: annotation.url! }))));
      const result = ResultSchema.safeParse({ summary, sources });
      if (!result.success || !sources.length) throw new AiError("api", "OpenAI returned no usable web citations. Try a more specific topic.");
      return jsonOk(result.data, ai.source);
    }

    const apiKey = ai.auth?.apiKey ?? process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) throw new AiError("auth", "No Anthropic API key is available. Add your key in Settings.");
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", signal,
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-opus-5", max_tokens: 4000, system: "Research the user's presentation request using current web sources. Write a concise factual research brief, cite findings inline, note caveats, and use only sourced claims.", messages: [{ role: "user", content: `Research request: ${body.data.query}` }], tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }] }),
    });
    if (!response.ok) throw new AiError(response.status === 401 || response.status === 403 ? "auth" : response.status === 429 ? "rate_limit" : "api", `Anthropic web research failed (HTTP ${response.status}).`, response.status);
    const data = await response.json() as { content?: Array<{ type?: string; text?: string; citations?: Array<{ url?: string; title?: string }> }> };
    const blocks = data.content ?? [];
    const summary = blocks.filter((block) => block.type === "text").map((block) => block.text ?? "").join("\n").trim();
    const sources = cleanSources(blocks.flatMap((block) => (block.citations ?? []).filter((citation) => citation.url).map((citation) => ({ title: citation.title ?? new URL(citation.url!).hostname, url: citation.url! }))));
    const result = ResultSchema.safeParse({ summary, sources });
    if (!result.success || !sources.length) throw new AiError("api", "Anthropic returned no usable web citations. Try a more specific topic.");
    return jsonOk(result.data, ai.source);
  } catch (err) {
    return jsonFailure(err, "Unexpected error while researching the web.");
  }
}
