import type { Scope } from "@/lib/assistant/scope";
import { LAYOUTS } from "@/lib/deck/layouts";

export type QuickAction = {
  label: string;
  /** Sent as-is when set. */
  instruction?: string;
  /** Otherwise the chip opens an inline input; `build` turns the value into the instruction. */
  prompt?: string;
  placeholder?: string;
  build?: (value: string) => string;
};

const LAYOUT_NAMES = LAYOUTS.filter((l) => l.id !== "blank")
  .map((l) => l.name.toLowerCase())
  .slice(0, 5)
  .join(", ");

/** Quick-action chips for the assistant, by scope and element type. */
export function actionsForScope(scope: Scope): QuickAction[] {
  switch (scope.kind) {
    case "deck":
      return [
        { label: "Shorten all", instruction: "Make the whole deck shorter and punchier. Keep the meaning, cut the words." },
        { label: "Add a slide about…", prompt: "Add a slide about", placeholder: "e.g. pricing, the team, next steps", build: (v) => `Add a slide about ${v}.` },
        { label: "Change tone…", prompt: "Change tone to", placeholder: "e.g. friendly, formal, bold", build: (v) => `Change the tone of the whole deck to ${v}.` },
        { label: "Translate…", prompt: "Translate to", placeholder: "e.g. Spanish, German, Japanese", build: (v) => `Translate the whole deck to ${v}. Keep names and numbers as they are.` },
      ];
    case "slide":
      return [
        { label: "Rewrite", instruction: "Rewrite this slide with clearer, more specific copy." },
        { label: "Shorter", instruction: "Make this slide shorter and punchier. Keep the meaning, cut the words." },
        { label: "More visual", instruction: "Make this slide more visual: prefer cards, stats or an image-and-text layout over long bullets." },
        { label: "Change layout to…", prompt: "Change layout to", placeholder: `e.g. ${LAYOUT_NAMES}`, build: (v) => `Change the layout of this slide to ${v}.` },
      ];
    case "element": {
      const el = scope.element;
      if (!el) return [];
      switch (el.type) {
        case "text":
          return [
            { label: "Rewrite", instruction: "Rewrite this text so it reads better. Keep the meaning." },
            { label: "Shorter", instruction: "Make this shorter." },
            { label: "Punchier", instruction: "Make this punchier." },
            { label: "Fix grammar", instruction: "Fix the grammar and punctuation." },
            { label: "Translate…", prompt: "Translate to", placeholder: "e.g. Spanish, German, Japanese", build: (v) => `Translate this to ${v}.` },
          ];
        case "image":
          return [
            { label: "New image idea", instruction: "Suggest a new image idea for this image." },
            { label: "Describe as…", prompt: "Describe as", placeholder: "e.g. a night skyline, abstract lines", build: (v) => `Describe this image as ${v}.` },
          ];
        case "card":
          return [
            { label: "Rewrite title", instruction: "Rewrite the title of this card." },
            { label: "Rewrite body", instruction: "Rewrite the body of this card." },
          ];
        default:
          return [];
      }
    }
  }
}
