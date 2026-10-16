"use client";

import { createElement, useMemo, useRef, useState } from "react";
import { resolveIcon } from "@/components/canvas/tokens";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { searchIcons } from "./icon-search";

export type IconPickerProps = {
  value: string | undefined;
  onChange: (name: string | undefined) => void;
  allowEmpty?: boolean;
  label?: string;
};

/** Button showing the current icon; opens a searchable grid of Phosphor icons. Enter picks the first match, Escape closes. */
export function IconPicker({ value, onChange, allowEmpty = false, label = "Icon" }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => (open ? searchIcons(query) : []), [open, query]);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setQuery("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger render={<button type="button" className="ps-btn ps-btn-block justify-start" aria-label={`${label}: ${value ?? "none"}`} />}>
        {value ? createElement(resolveIcon(value), { size: 14 }) : null}
        <span className="min-w-0 flex-1 truncate text-left">{value ?? "None"}</span>
      </PopoverTrigger>
      <PopoverContent align="end" side="bottom" className="ps-popover ps-popover-icons">
        <input
          ref={inputRef}
          className="ps-input"
          value={query}
          placeholder="Search icons…"
          aria-label="Search icons"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              return;
            }
            e.stopPropagation();
            if (e.key === "Enter" && results[0]) {
              onChange(results[0]);
              setOpen(false);
            }
          }}
        />
        <div className="ps-icon-results" role="listbox" aria-label="Icons">
          {results.map((name) => (
            <button
              key={name}
              type="button"
              role="option"
              aria-selected={name === value}
              aria-label={name}
              title={name}
              onClick={() => {
                onChange(name);
                setOpen(false);
              }}
            >
              {createElement(resolveIcon(name), { size: 18 })}
            </button>
          ))}
          {results.length === 0 ? <span className="ps-caption col-span-full p-2">No icons match “{query}”.</span> : null}
        </div>
        {allowEmpty && value ? (
          <button
            type="button"
            className="ps-link self-start"
            onClick={() => {
              onChange(undefined);
              setOpen(false);
            }}
          >
            Remove icon
          </button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
