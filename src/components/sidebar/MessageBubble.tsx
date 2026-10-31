"use client";

import { ArrowsClockwise, Sparkle, WarningCircle } from "@phosphor-icons/react";
import type { AssistantMessage } from "@/lib/assistant/history";

type Props = {
  message: AssistantMessage;
  /** The change is still the latest edit, so Undo can revert exactly it. */
  canUndo: boolean;
  onUndo: () => void;
  onShow: () => void;
  /** Resend the instruction that produced an error bubble. */
  onRetry?: () => void;
  disabled?: boolean;
};

/** One transcript entry: a user turn (surface-2 block), an assistant reply (plain text under a hairline with the applied changes and Undo / Show links), or an error with a retry link. */
export function MessageBubble({
  message: m,
  canUndo,
  onUndo,
  onShow,
  onRetry,
  disabled,
}: Props) {
  if (m.role === "user") {
    return (
      <div className="ps-msg-user">
        <span className="ps-scope-tag">{m.scopeLabel}</span>
        <div className="ps-bubble-user">{m.text}</div>
      </div>
    );
  }
  if (m.role === "error") {
    return (
      <div role="alert" className="ps-bubble-error">
        <WarningCircle size={16} weight="fill" className="mt-px shrink-0" />
        <div className="min-w-0 flex-1">
          <p>{m.text}</p>
          {m.code ? (
            <p className="mt-0.5 text-[11px] leading-4 opacity-80">
              code: {m.code}
            </p>
          ) : null}
          {onRetry ? (
            <button
              type="button"
              className="ps-link mt-1.5 inline-flex items-center gap-1"
              onClick={onRetry}
              disabled={disabled}
            >
              <ArrowsClockwise size={12} weight="bold" /> Try again
            </button>
          ) : null}
        </div>
      </div>
    );
  }
  const ops = m.opsText ?? [];
  return (
    <div className="ps-chat-row">
      <span className="ps-chat-avatar" aria-hidden>
        <Sparkle size={12} weight="fill" />
      </span>
      <div className="ps-bubble-assistant">
        <p>{m.text}</p>
        {ops.length ? (
          <ul className="ps-bubble-ops">
            {ops.map((o, i) => (
              <li key={i}>
                <span>{o}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ps-caption mt-1">No changes were needed.</p>
        )}
        <div className="ps-bubble-meta">
          {m.undone ? (
            <span>Undone</span>
          ) : m.appliedAt ? (
            <button
              type="button"
              className="ps-link"
              onClick={onUndo}
              disabled={!canUndo}
              title={
                canUndo
                  ? "Undo this change"
                  : "Later edits exist; use Undo in the toolbar"
              }
            >
              Undo
            </button>
          ) : null}
          {m.target && !m.undone ? (
            <button type="button" className="ps-link" onClick={onShow}>
              Show
            </button>
          ) : null}
          <span className="ml-auto ps-chat-source">
            {m.source === "claude"
              ? "Claude"
              : m.source === "openai"
                ? "OpenAI"
                : m.source === "gemini"
                  ? "Gemini"
                  : m.source === "presenta"
                    ? "Presenta Studio"
                    : m.source === "mock"
                      ? "Offline"
                      : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
