"use client";

import { Check } from "@phosphor-icons/react";
import type { Theme } from "@/lib/deck/schema";
import { THEMES } from "@/lib/deck/themes";
import { useDeckStore } from "@/store/deck-store";
import { ThemeSwatch } from "./ThemeSwatch";

const ALL_THEMES: Theme[] = Object.values(THEMES);

type Props = { onPick?: () => void };

/** Grid of themes; selecting one calls setTheme. Used by the Design tab and the toolbar popover. */
export function ThemeGrid({ onPick }: Props) {
  const themeId = useDeckStore((s) => s.deck?.themeId);
  const setTheme = useDeckStore((s) => s.setTheme);
  return (
    <div className="ps-theme-grid" role="listbox" aria-label="Themes">
      {ALL_THEMES.map((t) => {
        const active = t.id === themeId;
        return (
          <button
            key={t.id}
            type="button"
            role="option"
            aria-selected={active}
            title={t.description}
            onClick={() => {
              if (!active) setTheme(t.id);
              onPick?.();
            }}
            className="ps-theme-tile"
          >
            <ThemeSwatch pair={t.swatch} />
            <span className="min-w-0 flex-1 truncate">{t.name}</span>
            {active ? <Check size={14} weight="bold" className="shrink-0 text-[var(--ps-ink)]" /> : null}
          </button>
        );
      })}
    </div>
  );
}
