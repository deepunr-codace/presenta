"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowsClockwise } from "@phosphor-icons/react";
import {
  selectMessages,
  useAssistantHistory,
  type AssistantMessage,
} from "@/lib/assistant/history";
import { getScope } from "@/lib/assistant/scope";
import { useDeckStore } from "@/store/deck-store";
import { AssistantComposer } from "./AssistantComposer";
import { AssistantEmpty } from "./AssistantEmpty";
import { MessageBubble } from "./MessageBubble";
import { QuickActions } from "./QuickActions";
import { ScopeBar } from "./ScopeBar";
import { useAssistant } from "./useAssistant";

type Widen = "deck" | "slide" | null;

export type AssistantTabProps = {
  /** Start widened to this level (the review page starts at deck scope). */
  defaultScope?: "deck" | "slide" | "element";
};

/** The user turn that produced an error bubble, for the retry link. */
function previousUserText(
  messages: AssistantMessage[],
  index: number,
): string | null {
  for (let i = index - 1; i >= 0; i--)
    if (messages[i].role === "user") return messages[i].text;
  return null;
}

/** Assistant panel: scope chips, transcript, scope-aware quick actions and the composer. */
export function AssistantTab({ defaultScope = "element" }: AssistantTabProps) {
  const deck = useDeckStore((s) => s.deck);
  const selectedSlideId = useDeckStore((s) => s.selectedSlideId);
  const selectedElementIds = useDeckStore((s) => s.selectedElementIds);
  const undo = useDeckStore((s) => s.undo);
  const selectSlide = useDeckStore((s) => s.selectSlide);
  const selectElements = useDeckStore((s) => s.selectElements);
  const deckUpdatedAt = deck?.updatedAt;

  const { send, sending } = useAssistant();
  const messages = useAssistantHistory(selectMessages(deck?.id ?? null));
  const updateMessage = useAssistantHistory((s) => s.update);

  const [widen, setWiden] = useState<Widen>(
    defaultScope === "element" ? null : defaultScope,
  );
  const listRef = useRef<HTMLDivElement>(null);

  // A new selection on the canvas narrows the scope back to what is selected.
  const selectionKey = `${selectedSlideId ?? ""}|${selectedElementIds.join(",")}`;
  const [seenKey, setSeenKey] = useState<string | null>(null);
  if (seenKey !== selectionKey) {
    if (seenKey !== null) setWiden(null);
    setSeenKey(selectionKey);
  }

  const state = useMemo(
    () => ({ deck, selectedSlideId, selectedElementIds }),
    [deck, selectedSlideId, selectedElementIds],
  );
  const narrowest = useMemo(() => getScope(state), [state]);
  const scope = useMemo(
    () => getScope(state, widen ?? undefined),
    [state, widen],
  );

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, sending]);

  const pick = (kind: "deck" | "slide" | "element") =>
    setWiden(kind === "element" ? null : kind);

  const show = (m: AssistantMessage) => {
    const t = m.target;
    const d = useDeckStore.getState().deck;
    if (!t || !d) return;
    const slide = d.slides.find((s) => s.id === t.slideId);
    if (!slide) return;
    selectSlide(slide.id);
    if (t.elementId && slide.elements.some((e) => e.id === t.elementId))
      selectElements([t.elementId]);
    else selectElements([]);
  };

  const undoMessage = (m: AssistantMessage) => {
    if (!deck) return;
    undo();
    updateMessage(deck.id, m.id, { undone: true });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScopeBar scope={scope} narrowest={narrowest} onPick={pick} />

      <div ref={listRef} className="ps-messages" aria-live="polite">
        {messages.length === 0 ? <AssistantEmpty scope={scope} /> : null}
        {messages.map((m, i) => {
          const retryText =
            m.role === "error" ? previousUserText(messages, i) : null;
          return (
            <MessageBubble
              key={m.id}
              message={m}
              canUndo={
                Boolean(m.appliedAt) &&
                m.appliedAt === deckUpdatedAt &&
                !m.undone
              }
              onUndo={() => undoMessage(m)}
              onShow={() => show(m)}
              onRetry={
                retryText ? () => void send(retryText, scope) : undefined
              }
              disabled={sending || !deck}
            />
          );
        })}
        {sending ? (
          <div className="ps-chat-row" aria-busy="true">
            <span className="ps-chat-avatar" aria-hidden>
              <ArrowsClockwise size={12} className="animate-spin" />
            </span>
            <div
              className="ps-chat-bubble ps-chat-typing"
              aria-label="Working on it"
            >
              <i />
              <i />
              <i />
            </div>
          </div>
        ) : null}
      </div>

      <div className="ps-sb-divider" />
      <QuickActions
        scope={scope}
        disabled={sending || !deck}
        onSend={(instruction) => void send(instruction, scope)}
      />
      <AssistantComposer
        scope={scope}
        disabled={!deck}
        busy={sending}
        onSend={(text) => void send(text, scope)}
      />
    </div>
  );
}
