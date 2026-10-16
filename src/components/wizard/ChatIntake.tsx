"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowCounterClockwise, ArrowRight, ArrowUp, Sparkle } from "@phosphor-icons/react";
import { postSuggest } from "@/lib/api-client";
import type { Brief, SuggestRequest } from "@/lib/deck/schema";
import { GHOST_BTN, SECONDARY_BTN } from "@/lib/styles";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BriefSummaryCard } from "./BriefSummaryCard";
import { SuggestionsPanel } from "./SuggestionsPanel";
import { STAGE_META, STAGE_ORDER, briefPatch, firstQuestion, nextStage, toTurns } from "./chat-stages";
import type { SuggestState } from "./SuggestionsBody";
import { useMediaQuery } from "@/components/shell/useMediaQuery";
import { messageId, useWizardStore } from "./wizard-state";

type Props = { onBuildOutline: () => void };

/** Five-question conversation that fills the brief; each assistant question comes with AI suggestions. */
export function ChatIntake({ onBuildOutline }: Props) {
  const messages = useWizardStore((s) => s.chat.messages);
  const stage = useWizardStore((s) => s.chat.stage);
  const brief = useWizardStore((s) => s.brief);
  const startChat = useWizardStore((s) => s.startChat);
  const appendChat = useWizardStore((s) => s.appendChat);
  const patchBrief = useWizardStore((s) => s.patchBrief);
  const resetChat = useWizardStore((s) => s.resetChat);

  const [draft, setDraft] = useState("");
  const [suggestions, setSuggestions] = useState<Record<string, SuggestState>>({});
  const [sheetOpen, setSheetOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const desktop = useMediaQuery("(min-width: 768px)");

  useEffect(() => {
    if (!messages.length) startChat(firstQuestion());
  }, [messages.length, startChat]);

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const askingId = lastAssistant && lastAssistant.stage && lastAssistant.stage !== "confirm" ? lastAssistant.id : null;

  // Ask for suggestions once per assistant question; "loading" is the missing entry.
  useEffect(() => {
    if (!lastAssistant || !askingId || !lastAssistant.stage || lastAssistant.stage === "confirm") return;
    if (suggestions[askingId]) return;
    const ac = new AbortController();
    const state = useWizardStore.getState();
    const req: SuggestRequest = {
      stage: lastAssistant.stage,
      question: lastAssistant.text.slice(0, 400),
      brief: state.brief,
      history: toTurns(state.chat.messages),
    };
    const id = askingId;
    void postSuggest(req, ac.signal).then((res) => {
      if (ac.signal.aborted) return;
      setSuggestions((s) => ({ ...s, [id]: res.ok ? { status: "ready", data: res.data } : { status: "error", message: res.error } }));
    });
    return () => ac.abort();
  }, [askingId, lastAssistant, suggestions]);

  const retrySuggestions = useCallback((id: string) => {
    setSuggestions((s) => {
      const next = { ...s };
      delete next[id];
      return next;
    });
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, suggestions]);

  const advance = (userText: string, patch: Partial<Brief> | null) => {
    if (stage === "confirm") return;
    if (patch) patchBrief(patch);
    const next = nextStage(stage);
    appendChat(
      [
        { id: messageId(), role: "user", text: userText },
        { id: messageId(), role: "assistant", stage: next, text: STAGE_META[next].question },
      ],
      next,
    );
    setDraft("");
  };

  const send = () => {
    const t = draft.trim();
    if (!t) return;
    advance(t, briefPatch(stage, t));
  };

  const skip = () => {
    if (!STAGE_META[stage].optional) return;
    advance("Skip", null);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  const useSuggestion = (value: string) => {
    setDraft(value);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const meta = STAGE_META[stage];
  const confirming = stage === "confirm";
  const stageNumber = Math.min(STAGE_ORDER.indexOf(stage) + 1, STAGE_ORDER.length - 1);

  return (
    <section className="ps-glass overflow-hidden p-0" aria-label="Conversation">
      <div className="flex items-center justify-between border-b border-[var(--ps-line)] px-5 py-3">
        <p className="ps-body" aria-live="polite">
          {confirming ? (
            "Brief complete"
          ) : (
            <>
              Question {stageNumber} of {STAGE_ORDER.length - 1} · <span className="font-medium text-[var(--ps-ink)]">{meta.label}</span>
              {meta.optional ? <span className="text-[var(--ps-ash)]"> · optional</span> : null}
            </>
          )}
        </p>
        <Button variant="ghost" size="xs" className={GHOST_BTN} onClick={() => resetChat(firstQuestion())} disabled={messages.length <= 1}>
          <ArrowCounterClockwise data-icon="inline-start" /> Restart
        </Button>
      </div>

      <div ref={listRef} className="max-h-[520px] min-h-[360px] space-y-3 overflow-y-auto px-5 py-5">
        {messages.map((m) => {
          const isAsking = m.id === askingId;
          const st: SuggestState | undefined = suggestions[m.id] ?? (isAsking ? { status: "loading" } : undefined);
          const multi = STAGE_META[m.stage ?? "topic"].multi;
          return (
            <div key={m.id} className={cn("flex flex-col", m.role === "user" ? "items-end" : "items-start")}>
              <div className={cn("max-w-[85%] px-4 py-2.5 text-[14px] leading-6 whitespace-pre-wrap text-[var(--ps-ink)]", m.role === "user" ? "rounded-[var(--ps-r-sm)] bg-[var(--ps-plate)]" : "ps-tile")}>{m.text}</div>
              {isAsking && st ? (
                desktop === false ? (
                  <div className="mt-2">
                    <Button variant="outline" size="sm" className={SECONDARY_BTN} onClick={() => setSheetOpen(true)}>
                      <Sparkle data-icon="inline-start" weight="fill" /> Suggestions
                    </Button>
                    <SuggestionsPanel variant="dialog" open={sheetOpen} onOpenChange={setSheetOpen} state={st} multi={multi} onUse={useSuggestion} onRetry={() => retrySuggestions(m.id)} />
                  </div>
                ) : (
                  <div className="mt-2 w-full max-w-[85%]">
                    <SuggestionsPanel variant="inline" state={st} multi={multi} onUse={useSuggestion} onRetry={() => retrySuggestions(m.id)} />
                  </div>
                )
              ) : null}
            </div>
          );
        })}

        {confirming ? <BriefSummaryCard brief={brief} onChange={patchBrief} onBuildOutline={onBuildOutline} /> : null}
      </div>

      {!confirming ? (
        <div className="border-t border-[var(--ps-line)] p-5">
          <div className="ps-prompt min-h-0 p-3">
            <div className="flex items-end gap-2">
              <textarea ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} placeholder={meta.placeholder} rows={2} maxLength={meta.multi ? 1300 : meta.max} className="min-h-[44px] flex-1" aria-label="Your answer" />
              <button type="button" className="ps-send shrink-0" data-icon-only="" onClick={send} disabled={!draft.trim()} aria-label="Send">
                <ArrowUp size={14} weight="bold" />
              </button>
            </div>
          </div>
          <div className="ps-caption mt-1.5 flex items-center justify-between">
            <span>Enter to send · Shift+Enter for a new line</span>
            {meta.optional ? (
              <button type="button" onClick={skip} className="ps-link inline-flex items-center gap-1 text-[12px]">
                Skip this question <ArrowRight size={11} weight="bold" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
