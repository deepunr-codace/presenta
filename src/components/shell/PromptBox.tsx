"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ArrowRight, CircleNotch, Sparkle, WifiSlash } from "@phosphor-icons/react";
import { useAiHealth } from "@/hooks/useAiHealth";
import { suggestPromptCompletion } from "@/lib/suggest-prompt";
import { useApiKeyDialog } from "./api-key-dialog-store";

export type PromptBoxProps = {
  onSubmit: (text: string) => void;
  placeholder?: string;
  /** Status tag in the footer; defaults to the AI health check ("Offline", "Claude" or "OpenAI"). */
  footerPill?: "Offline" | "Claude" | "OpenAI" | "Presenta Studio";
  /** Label of the filled pill. */
  submitLabel?: ReactNode;
  /** Optional second path for the same prompt, e.g. a more automated create flow. */
  onSecondarySubmit?: (text: string) => void;
  secondarySubmitLabel?: ReactNode;
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
  { onSubmit, placeholder = "Describe the deck you need…", footerPill, submitLabel = "Create deck", onSecondarySubmit, secondarySubmitLabel = "Create with Agent", hero = false, starters, value, onChange, disabled = false, busy = false, autoFocus = false, maxLength = 2000, rows = 3, className, ariaLabel = "Prompt" },
  ref,
) {
  const [inner, setInner] = useState("");
  const controlled = value !== undefined;
  const text = controlled ? value : inner;
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const health = useAiHealth();
  const openKeyDialog = useApiKeyDialog((s) => s.setOpen);
  const pill: "Offline" | "Claude" | "OpenAI" | "Presenta Studio" | null = footerPill ?? (health ? (health.hasKey ? (health.provider === "presenta" ? "Presenta Studio" : health.provider === "openai" ? "OpenAI" : "Claude") : "Offline") : null);

  // Ghost-text continuation: offered only while the caret sits at the very end of the text, so accepting it
  // never clobbers something typed mid-sentence.
  const [caretAtEnd, setCaretAtEnd] = useState(true);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({ focus: () => areaRef.current?.focus() }), []);

  useEffect(() => {
    if (!caretAtEnd || disabled || busy) {
      setSuggestion(null);
      return;
    }
    const t = window.setTimeout(() => setSuggestion(suggestPromptCompletion(text)), 220);
    return () => window.clearTimeout(t);
  }, [text, caretAtEnd, disabled, busy]);

  const syncCaret = () => {
    const el = areaRef.current;
    if (el) setCaretAtEnd(el.selectionStart === el.value.length && el.selectionEnd === el.value.length);
  };

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

  const acceptSuggestion = () => {
    if (!suggestion) return;
    const next = (text + suggestion).slice(0, maxLength);
    setText(next);
    setSuggestion(null);
    requestAnimationFrame(() => {
      const el = areaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(next.length, next.length);
    });
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab" && suggestion && !e.shiftKey) {
      e.preventDefault();
      acceptSuggestion();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className={className ? `ps-prompt ${className}` : "ps-prompt"} data-hero={hero ? "" : undefined} onClick={(e) => e.target === e.currentTarget && areaRef.current?.focus()}>
      <div className="ps-prompt-ghost-wrap">
        <div className="ps-prompt-ghost" aria-hidden>
          <span className="ps-prompt-ghost-typed">{text || placeholder}</span>
          {suggestion && text ? (
            <button type="button" className="ps-prompt-ghost-suggestion" tabIndex={-1} onClick={acceptSuggestion} title="Click or press Tab to accept">
              {suggestion}
            </button>
          ) : null}
        </div>
        <textarea
          ref={areaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            syncCaret();
          }}
          onKeyDown={onKey}
          onKeyUp={syncCaret}
          onClick={syncCaret}
          onSelect={syncCaret}
          placeholder={placeholder}
          rows={rows}
          maxLength={maxLength}
          disabled={disabled}
          autoFocus={autoFocus}
          aria-label={ariaLabel}
        />
      </div>
      {suggestion && text ? (
        <p className="ps-prompt-ghost-hint">
          <Sparkle size={12} weight="fill" aria-hidden /> Presenta Studio suggests a refinement — press <kbd>Tab</kbd> or click it to accept
        </p>
      ) : null}
      {starters}
      <div className="ps-prompt-footer" data-secondary={onSecondarySubmit ? "true" : undefined}>
        {pill ? (
          <button type="button" className="ps-pill ps-pill-btn" data-tone={pill === "Offline" ? "warning" : "success"} title={pill === "Offline" ? "Offline demo: click to add your API key" : `${health?.model ?? ""} · click to change your API key`} onClick={() => openKeyDialog(true)}>
            {pill === "Offline" ? <WifiSlash weight="bold" /> : <Sparkle weight="fill" />}
            {pill}
          </button>
        ) : (
          <span className="ps-pill" aria-hidden>
            <span className="inline-block h-2 w-10 animate-pulse rounded-[var(--ps-r-pill)] bg-[var(--ps-line-2)]" />
          </span>
        )}
        <span className="ps-caption hidden sm:inline">Enter to create · Shift+Enter for a new line</span>
        {onSecondarySubmit ? (
          <button type="button" className="ps-btn" onClick={() => onSecondarySubmit(text.trim())} disabled={disabled || busy || !text.trim()}>
            {secondarySubmitLabel}
          </button>
        ) : null}
        <button type="button" className="ps-send ml-auto" onClick={submit} disabled={disabled || busy || !text.trim()}>
          {busy ? <CircleNotch size={14} weight="bold" className="animate-spin" /> : null}
          {submitLabel}
          {busy ? null : <ArrowRight size={14} weight="bold" />}
        </button>
      </div>
    </div>
  );
});

