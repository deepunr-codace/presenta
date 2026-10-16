import { SlideKindSchema, type SlideKind } from "@/lib/deck/schema";

export const KIND_LABEL: Record<SlideKind, string> = {
  cover: "Cover",
  section: "Section divider",
  bullets: "Bullets",
  "two-column": "Two columns",
  cards: "Cards",
  stats: "Stats",
  quote: "Quote",
  "image-text": "Image and text",
  process: "Process steps",
  comparison: "Comparison",
  closing: "Closing",
};

export const KINDS = SlideKindSchema.options;

export function isKind(v: unknown): v is SlideKind {
  return typeof v === "string" && (KINDS as readonly string[]).includes(v);
}
