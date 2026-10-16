"use client";

import { useDraft } from "./useDraft";

type Props = {
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
  id?: string;
  "aria-label"?: string;
  maxLength?: number;
};

/** Text input that commits on blur or Enter; Escape restores the committed value. */
export function TextInput({ value, onCommit, placeholder, id, "aria-label": ariaLabel, maxLength }: Props) {
  const [text, setText] = useDraft(value);
  return (
    <input
      id={id}
      className="ps-input"
      value={text}
      placeholder={placeholder}
      aria-label={ariaLabel}
      maxLength={maxLength}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        if (text !== value) onCommit(text);
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setText(value);
      }}
    />
  );
}
