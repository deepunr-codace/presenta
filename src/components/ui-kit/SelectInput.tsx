"use client";

import type { Option } from "./options";

type Props<T extends string> = {
  value: T;
  options: readonly Option<T>[];
  onChange: (v: T) => void;
  id?: string;
  "aria-label"?: string;
};

/** Native select styled as a sidebar input. */
export function SelectInput<T extends string>({ value, options, onChange, id, "aria-label": ariaLabel }: Props<T>) {
  return (
    <select id={id} className="ps-input" value={value} aria-label={ariaLabel} onChange={(e) => onChange(e.target.value as T)} onKeyDown={(e) => e.stopPropagation()}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
