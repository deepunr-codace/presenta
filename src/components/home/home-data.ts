import { newId } from "@/lib/deck/ids";
import type { Deck } from "@/lib/deck/schema";
import { STAGE_META, firstQuestion } from "@/components/wizard/chat-stages";
import { messageId, useWizardStore, type ChatMessage, type WizardData } from "@/components/wizard/wizard-state";
import { getBrandKit } from "@/lib/brand-kit";

/** Deep copy with a fresh id and timestamps, optionally retitled. */
export function cloneDeck(deck: Deck, title = deck.title): Deck {
  const now = new Date().toISOString();
  return { ...structuredClone(deck), id: newId("deck"), title, createdAt: now, updatedAt: now };
}

/** The saved brand kit as wizard data, so every new deck starts with the user's brand. */
function brandKitSeed(): Pick<WizardData, "brand"> & Partial<Pick<WizardData, "themeId">> {
  const kit = getBrandKit();
  return kit ? { brand: kit.brand, ...(kit.themeId ? { themeId: kit.themeId } : {}) } : { brand: {} };
}

/** Seed the wizard with the typed topic as the first answer of the chat intake. */
export function seedWizardFromPrompt(text: string): void {
  const topic = text.trim().slice(0, 300);
  const messages: ChatMessage[] = [firstQuestion(), { id: messageId(), role: "user", text: topic }, { id: messageId(), role: "assistant", stage: "audience", text: STAGE_META.audience.question }];
  useWizardStore.getState().seed({
    step: "brief",
    mode: "chat",
    brief: { topic },
    chat: { messages, stage: "audience" },
    ...brandKitSeed(),
  });
}

/** Start the wizard in paste mode. */
export function seedWizardForPaste(): void {
  useWizardStore.getState().seed({ step: "brief", mode: "paste", ...brandKitSeed() });
}
