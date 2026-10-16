import type { Brief, BriefStage, ChatTurn } from "@/lib/deck/schema";
import { messageId, type ChatMessage } from "./wizard-state";

export const STAGE_ORDER: readonly BriefStage[] = ["topic", "audience", "goal", "mustInclude", "angle", "confirm"];

export type StageMeta = { label: string; question: string; optional: boolean; multi: boolean; placeholder: string; max: number };

export const STAGE_META: Record<BriefStage, StageMeta> = {
  topic: { label: "Topic", question: "What is the deck about? A sentence or two is plenty.", optional: false, multi: false, placeholder: "e.g. A Q3 business review for the leadership team", max: 300 },
  audience: { label: "Audience", question: "Who will see it?", optional: false, multi: false, placeholder: "e.g. the executive team, new customers, a room of engineers", max: 120 },
  goal: { label: "Goal", question: "What should the audience think or do afterwards?", optional: true, multi: false, placeholder: "e.g. approve the budget, understand the roadmap", max: 200 },
  mustInclude: { label: "Must include", question: "Any points, numbers or names that must be in the deck?", optional: true, multi: true, placeholder: "Separate items with a semicolon", max: 120 },
  angle: { label: "Angle", question: "Is there an angle or framing you want to lead with?", optional: true, multi: false, placeholder: "e.g. lead with the customer story, keep it data-first", max: 200 },
  confirm: { label: "Confirm", question: "Here is the brief. Edit anything below, then build the outline.", optional: false, multi: false, placeholder: "", max: 0 },
};

export function firstQuestion(): ChatMessage {
  return { id: messageId(), role: "assistant", stage: "topic", text: STAGE_META.topic.question };
}

export function nextStage(stage: BriefStage): BriefStage {
  const i = STAGE_ORDER.indexOf(stage);
  return STAGE_ORDER[Math.min(i + 1, STAGE_ORDER.length - 1)];
}

function parseMustInclude(text: string): string[] {
  return text
    .split(/;|\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10)
    .map((s) => s.slice(0, 120));
}

/** The brief fields an answer at `stage` fills in. */
export function briefPatch(stage: BriefStage, value: string): Partial<Brief> {
  switch (stage) {
    case "topic":
      return { topic: value.slice(0, 300) };
    case "audience":
      return { audience: value.slice(0, 120) };
    case "goal":
      return { goal: value.slice(0, 200) };
    case "mustInclude":
      return { mustInclude: parseMustInclude(value) };
    case "angle":
      return { angle: value.slice(0, 200) };
    case "confirm":
      return {};
  }
}

/** Recent transcript in the shape the suggest API expects. */
export function toTurns(messages: ChatMessage[]): ChatTurn[] {
  return messages.slice(-30).map((m) => ({ role: m.role, content: m.text.slice(0, 4000) }));
}
