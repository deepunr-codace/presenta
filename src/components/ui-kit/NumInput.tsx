"use client";

import { useDraft } from "./useDraft";

type Props = {
  value: number;
  onCommit: (n: number) => void;
  step?: number;
  min?: number;
  max?: number;
  id?: string;
  "aria-label"?: string;
  /** Display precision. */
  digits?: number;
  disabled?: boolean;
};

/** Number input that commits on blur or Enter; arrow keys nudge (Shift ×10). */
export function NumInput({ value, onCommit, step = 1, min, max, id, digits = 0, disabled, "aria-label": ariaLabel }: Props) {
  const shown = Number.isFinite(value) ? Number(value.toFixed(digits)).toString() : "";
  const [text, setText] = useDraft(shown);
  const clamp = (n: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
  const commit = (raw: string) => {
    const n = Number(raw);
    if (!Number.isFinite(n) || raw.trim() === "") {
      setText(shown);
      return;
    }
    const next = clamp(n);
    if (next !== value) onCommit(next);
    else setText(shown);
  };
  return (
    <input
      id={id}
      type="number"
      inputMode="decimal"
      className="ps-input"
      step={step}
      min={min}
      max={max}
      value={text}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(e) => setText(e.target.value)}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          const d = (e.key === "ArrowUp" ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
          const base = Number(text);
          const next = clamp((Number.isFinite(base) ? base : value) + d);
          setText(String(Number(next.toFixed(digits))));
          onCommit(next);
        }
      }}
    />
  );
}
