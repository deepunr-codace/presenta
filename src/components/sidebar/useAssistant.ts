"use client";

import { useCallback } from "react";
import { create } from "zustand";
import { postRevise } from "@/lib/api-client";
import { describeOps, opsTarget } from "@/lib/assistant/describe";
import { useAssistantHistory } from "@/lib/assistant/history";
import { selectionForApi, type Scope } from "@/lib/assistant/scope";
import { useDeckStore } from "@/store/deck-store";

/** In-flight state shared by everything that can trigger the assistant (tab, quick actions, image props). */
export const useAssistantRun = create<{ sending: boolean; setSending: (v: boolean) => void }>()((set) => ({
  sending: false,
  setSending: (sending) => set({ sending }),
}));

/**
 * One revise round-trip: log the user's turn, call /api/revise with the
 * scope's selection, apply the returned ops in a single undoable commit and
 * log the assistant's reply (or an error bubble).
 */
export async function runAssistant(instruction: string, scope: Scope): Promise<void> {
  const text = instruction.trim();
  const deck = useDeckStore.getState().deck;
  const run = useAssistantRun.getState();
  if (!text || !deck || run.sending) return;
  const deckId = deck.id;
  const history = useAssistantHistory.getState();

  history.add(deckId, { role: "user", text, scopeLabel: scope.label });
  run.setSending(true);
  const res = await postRevise({
    deck,
    selectedSlideIndex: scope.kind === "deck" ? undefined : scope.slideIndex,
    selection: selectionForApi(scope),
    instruction: text.slice(0, 4000),
  });
  useAssistantRun.getState().setSending(false);

  if (!res.ok) {
    history.add(deckId, { role: "error", text: res.error, code: res.code, scopeLabel: scope.label });
    return;
  }
  const store = useDeckStore.getState();
  const latest = store.deck;
  if (!latest || latest.id !== deckId) {
    history.add(deckId, { role: "error", text: "The deck changed while the assistant was working; nothing was applied.", code: "stale", scopeLabel: scope.label });
    return;
  }
  const ops = res.data.ops;
  const opsText = describeOps(ops, latest);
  const where = opsTarget(ops, latest);
  const target = where ? { slideId: latest.slides[where.slideIndex].id, elementId: where.elementId } : undefined;
  let appliedAt: string | undefined;
  if (ops.length) {
    store.applyPatch(ops);
    appliedAt = useDeckStore.getState().deck?.updatedAt;
  }
  history.add(deckId, { role: "assistant", text: res.data.summary, ops, opsText, source: res.source, target, appliedAt, scopeLabel: scope.label });
}

export function useAssistant() {
  const sending = useAssistantRun((s) => s.sending);
  const send = useCallback((instruction: string, scope: Scope) => runAssistant(instruction, scope), []);
  return { send, sending };
}
