import { reviseDeck, resolveAi } from "@/lib/ai";
import { ReviseRequestSchema } from "@/lib/deck/schema";
import { jsonError, jsonFailure, jsonOk, readJsonBody } from "../_lib/respond";

export const runtime = "nodejs";
/** Vercel function limit; one AI attempt may take up to 55 s plus one retry. */
export const maxDuration = 120;

export async function POST(request: Request) {
  const body = await readJsonBody(request, ReviseRequestSchema);
  if (!body.ok) return body.response;
  const { deck, selectedSlideIndex, selection } = body.data;
  if (selectedSlideIndex !== undefined && selectedSlideIndex >= deck.slides.length) {
    return jsonError(400, "invalid", "selectedSlideIndex is out of range for this deck.");
  }
  if (selection) {
    const slide = deck.slides[selection.slideIndex];
    if (!slide) return jsonError(400, "invalid", "selection.slideIndex is out of range for this deck.");
    if (selection.elementId !== undefined && !slide.elements.some((el) => el.id === selection.elementId)) {
      return jsonError(400, "invalid", "selection.elementId is not on the selected slide.");
    }
  }

  const ai = resolveAi(request);
  try {
    return jsonOk(await reviseDeck(body.data, { signal: request.signal, ai }), ai.source);
  } catch (err) {
    return jsonFailure(err, "Unexpected error while revising the deck.");
  }
}
