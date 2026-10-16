import { create } from "zustand";
import type { AiSource } from "@/lib/api-client";
import type { PatchOp } from "@/lib/deck/schema";

/**
 * Assistant conversation history, kept per deck id for the life of the page.
 * Not persisted: it is a log of what the assistant did, not deck data.
 */

export type AssistantMessage = {
  id: string;
  role: "user" | "assistant" | "error";
  text: string;
  /** Ops that were applied, when the message is an assistant reply. */
  ops?: PatchOp[];
  /** The same ops in plain words. */
  opsText?: string[];
  scopeLabel: string;
  /** ISO timestamp. */
  at: string;
  source?: AiSource;
  /** Where the change landed, so "Show" can select it. */
  target?: { slideId: string; elementId?: string };
  /** `deck.updatedAt` after the ops were applied; Undo is offered while it is still the latest commit. */
  appliedAt?: string;
  /** Set once the user undid this reply from the message. */
  undone?: boolean;
  /** Error code for error bubbles. */
  code?: string;
};

type HistoryState = {
  byDeck: Record<string, AssistantMessage[]>;
  add: (deckId: string, message: Omit<AssistantMessage, "id" | "at"> & Partial<Pick<AssistantMessage, "id" | "at">>) => AssistantMessage;
  update: (deckId: string, id: string, patch: Partial<AssistantMessage>) => void;
  clear: (deckId: string) => void;
};

let counter = 0;
const nextId = () => `msg${Date.now().toString(36)}${(++counter).toString(36)}`;

const EMPTY: AssistantMessage[] = [];

export const useAssistantHistory = create<HistoryState>()((set) => ({
  byDeck: {},
  add: (deckId, message) => {
    const full: AssistantMessage = { ...message, id: message.id ?? nextId(), at: message.at ?? new Date().toISOString() };
    set((s) => ({ byDeck: { ...s.byDeck, [deckId]: [...(s.byDeck[deckId] ?? []), full] } }));
    return full;
  },
  update: (deckId, id, patch) =>
    set((s) => {
      const list = s.byDeck[deckId];
      if (!list) return s;
      return { byDeck: { ...s.byDeck, [deckId]: list.map((m) => (m.id === id ? { ...m, ...patch } : m)) } };
    }),
  clear: (deckId) =>
    set((s) => {
      if (!s.byDeck[deckId]) return s;
      const byDeck = { ...s.byDeck };
      delete byDeck[deckId];
      return { byDeck };
    }),
}));

/** Selector: messages for one deck (stable empty array when none). */
export const selectMessages = (deckId: string | null) => (s: HistoryState) => (deckId ? (s.byDeck[deckId] ?? EMPTY) : EMPTY);
