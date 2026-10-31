"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowCounterClockwise, ArrowRight, ArrowUp, Check, Plus, Sparkle } from "@phosphor-icons/react";
import { postSuggest } from "@/lib/api-client";
import type { Brief, SuggestRequest, SuggestResponse } from "@/lib/deck/schema";
import { GHOST_BTN } from "@/lib/styles";
import { Button } from "@/components/ui/button";
import { BriefSummaryCard } from "./BriefSummaryCard";
import { STAGE_META, STAGE_ORDER, briefPatch, firstQuestion, nextStage, toTurns } from "./chat-stages";
import { messageId, useWizardStore } from "./wizard-state";

type Props = { onBuildOutline: () => void };

type SuggestState = { status: "loading" } | { status: "ready"; data: SuggestResponse } | { status: "error"; message: string };

const splitItems = (text: string) =>
  text
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

function AssistantAvatar() {
  return (
    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--ps-ink)] text-[var(--ps-on-ink)]" aria-hidden>
      <Sparkle size={13} weight="fill" />
    </span>
  );
}

/** Three dots while the assistant is thinking of answers. */
function Typing() {
  return (
    <span className="inline-flex items-center gap-1 py-1" aria-label="Thinking of suggestions">
      {[0, 150, 300].map((d) => (
        <span key={d} className="size-1.5 animate-bounce rounded-full bg-[var(--ps-ash)] motion-reduce:animate-none" style={{ animationDelay: `${d}ms` }} />
      ))}
    </span>
  );
}

/**
 * The brief as a chat: the assistant asks five short questions, you answer in the message box or tap a suggested
 * reply, and the brief fills in as you go.
 */
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
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!messages.length) startChat(firstQuestion());
  }, [messages.length, startChat]);

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const askingId = lastAssistant && lastAssistant.stage && lastAssistant.stage !== "confirm" ? lastAssistant.id : null;

  // Ask for suggested replies once per question; "loading" is the missing entry.
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
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
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
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const sendText = (text: string) => {
    const t = text.trim();
    if (!t) return;
    advance(t, briefPatch(stage, t));
  };

  const skip = () => {
    if (STAGE_META[stage].optional) advance("Skip", null);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      sendText(draft);
    }
  };

  const meta = STAGE_META[stage];
  const confirming = stage === "confirm";
  const total = STAGE_ORDER.length - 1;
  const stageNumber = Math.min(STAGE_ORDER.indexOf(stage) + 1, total);
  const picked = meta.multi ? splitItems(draft) : [];

  /** One answer: send it straight away. Several (must include): add or remove it in the message box. */
  const tapReply = (s: string) => {
    if (!meta.multi) {
      sendText(s);
      return;
    }
    const items = splitItems(draft);
    setDraft((items.includes(s) ? items.filter((x) => x !== s) : [...items, s]).join("; "));
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const current: SuggestState | undefined = askingId ? (suggestions[askingId] ?? { status: "loading" }) : undefined;

  return (
    <section className="ps-glass flex flex-col overflow-hidden p-0" aria-label="Conversation">
      <div className="flex items-center gap-3 border-b border-[var(--ps-line)] px-5 py-3">
        <AssistantAvatar />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium text-[var(--ps-ink)]">Presenta assistant</p>
          <p className="ps-caption" aria-live="polite">
            {confirming ? "Brief complete" : `Question ${stageNumber} of ${total} · ${meta.label}${meta.optional ? " · optional" : ""}`}
          </p>
        </div>
        <div className="hidden h-1 w-24 overflow-hidden rounded-full bg-[var(--ps-plate)] sm:block" aria-hidden>
          <div className="h-full rounded-full bg-[var(--ps-ink)] transition-[width] duration-300" style={{ width: `${((confirming ? total : stageNumber - 1) / total) * 100}%` }} />
        </div>
        <Button variant="ghost" size="xs" className={GHOST_BTN} onClick={() => resetChat(firstQuestion())} disabled={messages.length <= 1}>
          <ArrowCounterClockwise data-icon="inline-start" /> Restart
        </Button>
      </div>

      <div ref={listRef} className="max-h-[520px] min-h-[360px] space-y-4 overflow-y-auto px-5 py-5" aria-live="polite">
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-md bg-[var(--ps-ink)] px-4 py-2.5 text-[14px] leading-6 whitespace-pre-wrap text-[var(--ps-on-ink)]">{m.text}</div>
            </div>
          ) : (
            <div key={m.id} className="flex items-end gap-2">
              <AssistantAvatar />
              <div className="max-w-[80%] rounded-2xl rounded-bl-md border border-[var(--ps-line)] bg-[var(--ps-plate)] px-4 py-2.5 text-[14px] leading-6 whitespace-pre-wrap text-[var(--ps-ink)]">{m.text}</div>
            </div>
          ),
        )}

        {/* Suggested replies for the open question, like quick replies in a messenger. */}
        {current && !confirming ? (
          <div className="pl-9">
            {current.status === "loading" ? (
              <div className="inline-flex rounded-2xl rounded-bl-md border border-[var(--ps-line)] bg-[var(--ps-plate)] px-4 py-2">
                <Typing />
              </div>
            ) : current.status === "error" ? (
              <p className="ps-caption">
                Suggestions are not available right now.{" "}
                <button type="button" className="ps-link" onClick={() => askingId && retrySuggestions(askingId)}>
                  Try again
                </button>{" "}
                or type your answer below.
              </p>
            ) : (
              <div className="ps-replies" role="group" aria-label={meta.multi ? "Suggested items, choose any" : "Suggested replies"}>
                {current.data.suggestions.map((s, i) => {
                  const on = picked.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => tapReply(s)}
                      aria-pressed={meta.multi ? on : undefined}
                      className="ps-reply"
                      style={{ animationDelay: `${i * 60}ms` }}
                    >
                      <span className="ps-reply-icon" aria-hidden>
                        {meta.multi ? on ? <Check size={12} weight="bold" /> : <Plus size={12} weight="bold" /> : <Sparkle size={12} weight="fill" />}
                      </span>
                      <span className="min-w-0">{s}</span>
                      {meta.multi ? null : <ArrowRight size={13} weight="bold" className="ps-reply-go" aria-hidden />}
                    </button>
                  );
                })}
                {meta.optional ? (
                  <button type="button" onClick={skip} className="ps-reply ps-reply-skip" style={{ animationDelay: `${current.data.suggestions.length * 60}ms` }}>
                    Skip
                  </button>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        {confirming ? <BriefSummaryCard brief={brief} onChange={patchBrief} onBuildOutline={onBuildOutline} /> : null}
      </div>

      {!confirming ? (
        <div className="border-t border-[var(--ps-line)] px-5 py-4">
          <div className="flex items-end gap-2 rounded-2xl border border-[var(--ps-line-2)] bg-[var(--ps-canvas)] py-2 pr-2 pl-4 focus-within:border-[var(--ps-ash)]">
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKey}
              placeholder={meta.multi ? "Type items, separated by semicolons…" : "Type your answer…"}
              rows={1}
              maxLength={meta.multi ? 1300 : meta.max}
              className="max-h-32 min-h-[36px] flex-1 resize-none bg-transparent py-1.5 text-[14px] leading-6 text-[var(--ps-ink)] outline-none placeholder:text-[var(--ps-ash)]"
              aria-label="Your answer"
            />
            <button type="button" className="ps-send shrink-0" data-icon-only="" onClick={() => sendText(draft)} disabled={!draft.trim()} aria-label="Send">
              <ArrowUp size={14} weight="bold" />
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
