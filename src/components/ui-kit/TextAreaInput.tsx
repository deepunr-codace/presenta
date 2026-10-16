"use client";

import { useDraft } from "./useDraft";

type Props = {
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
  rows?: number;
  id?: string;
  "aria-label"?: string;
};

/** Textarea that commits on blur. */
export function TextAreaInput({ value, onCommit, placeholder, rows = 3, id, "aria-label": ariaLabel }: Props) {
  const [text, setText] = useDraft(value);
  return (
    <textarea
      id={id}
      className="ps-input"
      rows={rows}
      value={text}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        if (text !== value) onCommit(text);
      }}
      onKeyDown={(e) => e.stopPropagation()}
    />
  );
}
