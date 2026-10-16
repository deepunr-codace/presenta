"use client";

import { forwardRef, useImperativeHandle, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ArrowRight, CircleNotch, Sparkle, WifiSlash } from "@phosphor-icons/react";
import { useAiHealth } from "@/hooks/useAiHealth";

export type PromptBoxProps = {
  onSubmit: (text: string) => void;
  placeholder?: string;
  /** Status tag in the footer; defaults to the AI health check ("Offline", "Claude" or "OpenAI"). */
  footerPill?: "Offline" | "Claude" | "OpenAI";
  /** Label of the filled pill. */
  submitLabel?: ReactNode;
  /** Wide taupe hero card (home) instead of the paper composer. */
  hero?: boolean;
  /** Starter chips rendered between the textarea and the footer. */
  starters?: ReactNode;
  /** Controlled value (optional). */
  value?: string;
  onChange?: (text: string) => void;
  disabled?: boolean;
  busy?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
  rows?: number;
  className?: string;
  ariaLabel?: string;
};

export type PromptBoxHandle = { focus: () => void };

/**
 * Prompt box (DESIGN.md §5): a card holding a borderless textarea, optional starter chips and a
 * footer with the status tag left and a filled pill right. Enter sends, Shift+Enter inserts a newline.
 */
export const PromptBox = forwardRef<PromptBoxHandle, PromptBoxProps>(function PromptBox(
  { onSubmit, placeholder = "Describe the deck you need…", footerPill, submitLabel = "Create deck", hero = false, starters, value, onChange, disabled = false, busy = false, autoFocus = false, maxLength = 2000, rows = 3, className, ariaLabel = "Prompt" },
  ref,
) {
  const [inner, setInner] = useState("");
  const controlled = value !== undefined;
  const text = controlled ? value : inner;
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const health = useAiHealth();
  const pill: "Offline" | "Claude" | "OpenAI" | null = footerPill ?? (health ? (health.hasKey ? (health.provider === "openai" ? "OpenAI" : "Claude") : "Offline") : null);

  useImperativeHandle(ref, () => ({ focus: () => areaRef.current?.focus() }), []);

  const setText = (next: string) => {
    if (!controlled) setInner(next);
    onChange?.(next);
  };

  const submit = () => {
    const t = text.trim();
    if (!t || disabled || busy) return;
    onSubmit(t);
    if (!controlled) setInner("");
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className={className ? `ps-prompt ${className}` : "ps-prompt"} data-hero={hero ? "" : undefined} onClick={(e) => e.target === e.currentTarget && areaRef.current?.focus()}>
      <textarea ref={areaRef} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} placeholder={placeholder} rows={rows} maxLength={maxLength} disabled={disabled} autoFocus={autoFocus} aria-label={ariaLabel} />
      {starters}
      <div className="ps-prompt-footer">
        {pill ? (
          <span className="ps-pill" data-tone={pill === "Offline" ? "warning" : "success"} title={pill === "Offline" ? "Offline mock mode: no API key on the server" : health?.model}>
            {pill === "Offline" ? <WifiSlash weight="bold" /> : <Sparkle weight="fill" />}
            {pill}
          </span>
        ) : (
          <span className="ps-pill" aria-hidden>
            <span className="inline-block h-2 w-10 animate-pulse rounded-[var(--ps-r-pill)] bg-[var(--ps-line-2)]" />
          </span>
        )}
        <span className="ps-caption hidden sm:inline">Enter to create · Shift+Enter for a new line</span>
        <button type="button" className="ps-send ml-auto" onClick={submit} disabled={disabled || busy || !text.trim()}>
          {busy ? <CircleNotch size={14} weight="bold" className="animate-spin" /> : null}
          {submitLabel}
          {busy ? null : <ArrowRight size={14} weight="bold" />}
        </button>
      </div>
    </div>
  );
});
