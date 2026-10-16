"use client";

import { Check } from "@phosphor-icons/react";
import type { ThemeId } from "@/lib/deck/schema";
import { THEMES } from "@/lib/deck/themes";

const THEME_LIST = Object.values(THEMES);

type Props = {
  value: ThemeId;
  onChange: (id: ThemeId) => void;
};

/** Radio group of theme tiles: a mini background with ink, muted and accent marks, then the name. */
export function ThemeRadioGrid({ value, onChange }: Props) {
  return (
    <div role="radiogroup" aria-label="Theme" className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 md:gap-2">
      {THEME_LIST.map((t) => {
        const selected = t.id === value;
        return (
          <button key={t.id} type="button" role="radio" aria-checked={selected} onClick={() => onChange(t.id)} title={t.description} data-active={selected ? "true" : undefined} data-clickable="" className="ps-tile ps-focus group relative flex min-w-0 flex-col overflow-hidden p-0 text-left">
            <span className="relative block aspect-[16/10] w-full" style={{ background: t.background.default }} aria-hidden>
              <span className="absolute top-2.5 left-2.5 h-1.5 w-10 rounded-full" style={{ background: t.colors.ink, opacity: 0.85 }} />
              <span className="absolute top-5.5 left-2.5 h-1 w-6 rounded-full" style={{ background: t.colors.muted, opacity: 0.7 }} />
              <span className="absolute right-2.5 bottom-2.5 size-4" style={{ background: t.colors.accent, borderRadius: Math.min(t.radius, 8) }} />
              {selected ? (
                <span className="absolute top-1.5 right-1.5 grid size-4 place-items-center rounded-full bg-[var(--ps-ink)] text-[var(--ps-on-ink)]">
                  <Check size={10} weight="bold" />
                </span>
              ) : null}
            </span>
            <span className="flex min-w-0 items-center gap-1.5 px-2.5 py-2 text-[13px] font-medium text-[var(--ps-ink)]">
              <span className="inline-block size-2.5 shrink-0 rounded-full ring-1 ring-[var(--ps-line-2)]" style={{ background: `linear-gradient(135deg, ${t.swatch[0]} 50%, ${t.swatch[1]} 50%)` }} />
              <span className="min-w-0 truncate">{t.name}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
