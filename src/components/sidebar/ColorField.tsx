"use client";

import { useMemo, useState } from "react";
import type { Theme } from "@/lib/deck/schema";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDraft } from "@/components/ui-kit/useDraft";
import { HEX, colorLabel, colorPresets, swatchCss } from "./color-presets";

export type ColorFieldProps = {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  theme?: Theme;
  /** Accept only #rrggbb (brand accent). */
  hexOnly?: boolean;
  /** Offer a "Default" option that clears the value. */
  allowEmpty?: boolean;
  emptyLabel?: string;
  label: string;
};

/** 20 px circle swatch with an inset ring; opens a popover with 12 presets, a text field and a native picker. Escape closes it. */
export function ColorField({ value, onChange, theme, hexOnly = false, allowEmpty = false, emptyLabel = "Default", label }: ColorFieldProps) {
  const [open, setOpen] = useState(false);
  const presets = useMemo(() => colorPresets(theme, hexOnly), [theme, hexOnly]);
  const css = swatchCss(value, theme);
  const [text, setText] = useDraft(value ?? "");

  const commitText = () => {
    const raw = text.trim();
    if (raw === "") {
      if (allowEmpty && value !== undefined) onChange(undefined);
      else setText(value ?? "");
      return;
    }
    const next = hexOnly ? (HEX.test(raw) ? raw.toUpperCase() : null) : raw;
    if (next === null) {
      setText(value ?? "");
      return;
    }
    if (next !== value) onChange(next);
  };

  const shown = colorLabel(value, emptyLabel);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<button type="button" className="ps-swatch ps-swatch-20" aria-label={`${label}: ${shown}`} title={shown} data-empty={!value} style={{ background: css ?? "var(--ps-surface)" }} />} />
      <PopoverContent align="end" side="bottom" className="ps-popover">
        <div className="ps-swatch-grid-20" role="listbox" aria-label={`${label} presets`}>
          {presets.map((p) => (
            <button
              key={p.value}
              type="button"
              role="option"
              className="ps-swatch ps-swatch-20"
              aria-selected={p.value === value}
              aria-label={p.label}
              title={p.label}
              style={{ background: p.css }}
              onClick={() => {
                if (p.value !== value) onChange(p.value);
                setOpen(false);
              }}
            />
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <input
            className="ps-input"
            value={text}
            placeholder={hexOnly ? "#1B5FD9" : "accent, #1B5FD9…"}
            aria-label={`${label} value`}
            spellCheck={false}
            onChange={(e) => setText(e.target.value)}
            onBlur={commitText}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setOpen(false);
                return;
              }
              e.stopPropagation();
              if (e.key === "Enter") {
                commitText();
                setOpen(false);
              }
            }}
          />
          <input
            type="color"
            aria-label={`${label} picker`}
            value={css && HEX.test(css) ? css : "#888888"}
            onChange={(e) => {
              setText(e.target.value.toUpperCase());
              onChange(e.target.value.toUpperCase());
            }}
            className="ps-swatch ps-swatch-20 ps-swatch-native"
          />
        </div>
        {allowEmpty && value ? (
          <button type="button" className="ps-link self-start" onClick={() => onChange(undefined)}>
            Use {emptyLabel.toLowerCase()}
          </button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
