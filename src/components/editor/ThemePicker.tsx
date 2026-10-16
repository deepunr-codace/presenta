"use client";

import { Palette } from "@phosphor-icons/react";
import { resolveTheme } from "@/lib/deck/themes";
import { useDeckStore } from "@/store/deck-store";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PanelHeader } from "@/components/ui-kit/PanelHeader";
import { ThemeGrid } from "./ThemeGrid";
import { ThemeSwatch } from "./ThemeSwatch";

/** Toolbar button showing the current theme; opens the theme grid in a popover. */
export function ThemePicker() {
  const deck = useDeckStore((s) => s.deck);
  const current = deck ? resolveTheme(deck) : undefined;
  return (
    <Popover>
      <PopoverTrigger render={<button type="button" className="ps-btn" disabled={!current} />}>
        {current ? <ThemeSwatch pair={current.swatch} className="h-4 w-6" /> : <Palette size={14} />}
        {current?.name ?? "Theme"}
      </PopoverTrigger>
      <PopoverContent align="start" className="ps-popover ps-popover-wide">
        <PanelHeader title="Theme" />
        <ThemeGrid />
      </PopoverContent>
    </Popover>
  );
}
