"use client";

import { useState, type KeyboardEvent } from "react";
import { CircleNotch, PaperPlaneRight } from "@phosphor-icons/react";
import { scopePlaceholder, type Scope } from "@/lib/assistant/scope";

type Props = {
  scope: Scope;
  disabled?: boolean;
  busy?: boolean;
  onSend: (text: string) => void;
};

/** Composer card: borderless textarea with a scope-aware placeholder; Cmd/Ctrl+Enter or the primary Send button submits. */
export function AssistantComposer({ scope, disabled = false, busy = false, onSend }: Props) {
  const [draft, setDraft] = useState("");

  const submit = () => {
    const text = draft.trim();
    if (!text || busy || disabled) return;
    setDraft("");
    onSend(text);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="ps-composer">
      <div className="ps-sb-prompt">
        <textarea value={draft} rows={2} placeholder={scopePlaceholder(scope)} aria-label="Instruction for the assistant" disabled={disabled} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} />
        <div className="ps-sb-prompt-footer">
          <span className="ps-sb-prompt-scope" title={scope.label}>
            {scope.label}
          </span>
          <span className="ps-sb-prompt-kbd" aria-hidden>
            ⌘↵
          </span>
          <button type="button" className="ps-sb-send" onClick={submit} disabled={!draft.trim() || busy || disabled} aria-label="Send">
            {busy ? <CircleNotch size={14} weight="bold" className="animate-spin" /> : <PaperPlaneRight size={14} weight="fill" />}
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
