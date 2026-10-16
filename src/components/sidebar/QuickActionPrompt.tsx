"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "@phosphor-icons/react";
import type { QuickAction } from "./quick-actions";

type Props = {
  action: QuickAction;
  disabled?: boolean;
  onSubmit: (instruction: string) => void;
  onCancel: () => void;
};

/** Inline input for a quick action that needs a value ("Add a slide about…"); Enter sends, Escape cancels. */
export function QuickActionPrompt({ action, disabled, onSubmit, onCancel }: Props) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = () => {
    if (!action.build || !value.trim()) return;
    onSubmit(action.build(value.trim()));
  };

  return (
    <div className="ps-chip-input">
      <span className="whitespace-nowrap">{action.prompt}</span>
      <input
        ref={inputRef}
        value={value}
        placeholder={action.placeholder}
        aria-label={action.prompt}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") onCancel();
          e.stopPropagation();
        }}
      />
      <button type="button" className="ps-btn ps-btn-primary ps-btn-xs" onClick={submit} disabled={!value.trim() || disabled}>
        Go
      </button>
      <button type="button" className="ps-iconbtn ps-iconbtn-sm" onClick={onCancel} aria-label="Cancel">
        <X size={12} weight="bold" />
      </button>
    </div>
  );
}
