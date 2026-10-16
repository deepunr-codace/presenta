"use client";

import type { ReactNode } from "react";

type Props<T extends string> = {
  value: T;
  options: readonly { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  "aria-label"?: string;
  disabled?: boolean;
};

/** Joined pill buttons for a small set of exclusive choices (`.ps-seg`). */
export function Segmented<T extends string>({ value, options, onChange, "aria-label": ariaLabel, disabled }: Props<T>) {
  return (
    <div className="ps-seg" role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} title={o.title} aria-label={typeof o.label === "string" ? undefined : o.title} disabled={disabled} onClick={() => o.value !== value && onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
