"use client";

import { useState } from "react";
import { Check, Lightbulb } from "@phosphor-icons/react";
import type { SuggestResponse } from "@/lib/deck/schema";
import { FIELD, PRIMARY_BTN, SECONDARY_BTN } from "@/lib/styles";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorNotice } from "@/components/ui-kit/ErrorNotice";

export type SuggestState = { status: "loading" } | { status: "ready"; data: SuggestResponse } | { status: "error"; message: string };

export type SuggestionsBodyProps = {
  state: SuggestState;
  /** Multi-select (mustInclude) or single choice. */
  multi: boolean;
  onUse: (value: string) => void;
  onRetry?: () => void;
  /** Called with false after a choice so a dialog host can close. */
  onOpenChange?: (open: boolean) => void;
};

/** Suggestion chips, hint and an "Other…" line; loading skeleton and error with retry. */
export function SuggestionsBody({ state, multi, onUse, onRetry, onOpenChange }: SuggestionsBodyProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [other, setOther] = useState("");

  const toggle = (s: string) => {
    setSelected((cur) => {
      if (multi) return cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s];
      return cur[0] === s ? [] : [s];
    });
  };

  const o = other.trim();
  const composed = multi ? [...selected, ...(o ? [o] : [])].join("; ") : o || selected[0] || "";

  const use = () => {
    if (!composed) return;
    onUse(composed);
    onOpenChange?.(false);
  };

  if (state.status === "loading") {
    return (
      <div className="flex flex-wrap gap-2" aria-busy="true" aria-label="Loading suggestions">
        {[112, 148, 96].map((w, i) => (
          <span key={i} className="h-7 animate-pulse rounded-[var(--ps-r-pill)] bg-[var(--ps-plate)]" style={{ width: w }} />
        ))}
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <ErrorNotice
        compact
        message={`Could not load suggestions. ${state.message}`}
        actions={
          onRetry ? (
            <Button variant="outline" size="xs" className={SECONDARY_BTN} onClick={onRetry}>
              Try again
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label={multi ? "Choose any" : "Choose one"}>
        {state.data.suggestions.map((s) => {
          const on = selected.includes(s);
          return (
            <button key={s} type="button" role={multi ? "checkbox" : "radio"} aria-checked={on} data-active={on ? "true" : undefined} onClick={() => toggle(s)} className="ps-chip h-auto min-h-7 max-w-full py-1 text-left whitespace-normal">
              {on ? <Check size={12} weight="bold" className="shrink-0" /> : null}
              <span className="min-w-0">{s}</span>
            </button>
          );
        })}
      </div>
      {state.data.hint ? (
        <p className="ps-caption flex items-start gap-1.5 text-[var(--ps-smoke)]">
          <Lightbulb size={13} className="mt-0.5 shrink-0" /> {state.data.hint}
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={other}
          onChange={(e) => setOther(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              use();
            }
          }}
          placeholder={multi ? "Other… (adds to your selection)" : "Other…"}
          aria-label="Other"
          maxLength={200}
          className={cn(FIELD, "h-9 flex-1")}
        />
        <Button size="default" className={cn(PRIMARY_BTN, "h-9 shrink-0 px-4")} onClick={use} disabled={!composed}>
          Use selection
        </Button>
      </div>
    </div>
  );
}
