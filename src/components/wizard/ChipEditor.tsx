"use client";

import { useState, type KeyboardEvent } from "react";
import { Plus, X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

/** Editable list of short strings shown as removable chips with an inline "add" field. */
type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
  maxLength?: number;
  placeholder?: string;
  size?: "sm" | "md";
  ariaLabel: string;
};

export function ChipEditor({ value, onChange, max, maxLength = 100, placeholder = "Add…", size = "md", ariaLabel }: Props) {
  const [draft, setDraft] = useState("");
  const full = max !== undefined && value.length >= max;

  const commit = () => {
    const t = draft.trim().slice(0, maxLength);
    if (!t || full) return;
    onChange([...value, t]);
    setDraft("");
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  const chip = size === "sm" ? "h-6 gap-1 pl-2.5 pr-1 text-[12px]" : "h-7 gap-1.5 pl-3 pr-1.5 text-[13px]";

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={ariaLabel}>
      {value.map((item, i) => (
        <span key={`${item}-${i}`} className={cn("inline-flex max-w-full items-center rounded-[var(--ps-r-pill)] border border-[var(--ps-line-2)] bg-[var(--ps-canvas)] text-[var(--ps-ink)]", chip)}>
          <span className="truncate">{item}</span>
          <button
            type="button"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
            className="ps-focus grid size-4 shrink-0 place-items-center rounded-[var(--ps-r-pill)] text-[var(--ps-ash)] hover:bg-[var(--ps-plate)] hover:text-[var(--ps-ink)]"
            aria-label={`Remove ${item}`}
          >
            <X size={10} weight="bold" />
          </button>
        </span>
      ))}
      {!full ? (
        <span className={cn("inline-flex max-w-full items-center rounded-[var(--ps-r-pill)] border border-dashed border-[var(--ps-line-2)] text-[var(--ps-smoke)] focus-within:border-[var(--ps-ink)]", chip)}>
          <Plus size={size === "sm" ? 10 : 12} weight="bold" className="shrink-0" />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            onBlur={commit}
            placeholder={placeholder}
            maxLength={maxLength}
            aria-label={`${ariaLabel}: add`}
            className="w-24 max-w-full min-w-0 bg-transparent text-[var(--ps-ink)] outline-none placeholder:text-[var(--ps-ash)] focus:w-40"
          />
        </span>
      ) : null}
    </div>
  );
}
