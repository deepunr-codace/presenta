"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { ArrowUp, CircleNotch } from "@phosphor-icons/react";
import { scopePlaceholder, type Scope } from "@/lib/assistant/scope";

type Props = {
  scope: Scope;
  disabled?: boolean;
  busy?: boolean;
  onSend: (text: string) => void;
};

/** Chat message box: Enter sends, Shift+Enter adds a line; the box grows with the message. */
export function AssistantComposer({
  scope,
  disabled = false,
  busy = false,
  onSend,
}: Props) {
  const [draft, setDraft] = useState("");
  const box = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const text = draft.trim();
    if (!text || busy || disabled) return;
    setDraft("");
    if (box.current) box.current.style.height = "";
    onSend(text);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="ps-composer">
      <div className="ps-chat-input">
        <textarea
          ref={box}
          value={draft}
          rows={1}
          placeholder={scopePlaceholder(scope)}
          aria-label="Message the assistant"
          disabled={disabled}
          onChange={(e) => {
            setDraft(e.target.value);
            e.currentTarget.style.height = "auto";
            e.currentTarget.style.height = `${Math.min(160, e.currentTarget.scrollHeight)}px`;
          }}
          onKeyDown={onKey}
        />
        <button
          type="button"
          className="ps-chat-send"
          onClick={submit}
          disabled={!draft.trim() || busy || disabled}
          aria-label="Send"
        >
          {busy ? (
            <CircleNotch size={14} weight="bold" className="animate-spin" />
          ) : (
            <ArrowUp size={14} weight="bold" />
          )}
        </button>
      </div>
      <p className="ps-chat-hint">
        Working on <strong title={scope.label}>{scope.label}</strong> · Enter to
        send
      </p>
    </div>
  );
}
