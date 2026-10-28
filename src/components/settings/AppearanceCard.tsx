"use client";

import { Desktop, Moon, Sun } from "@phosphor-icons/react";
import { useThemeMode, type ThemeMode } from "@/components/shell/ThemeMode";
import { PillTabs } from "@/components/ui-kit/PillTabs";

const MODES: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "Match my device", icon: Desktop },
];

/** Light, dark, or follow the device. Saved in this browser. */
export function AppearanceCard() {
  const { mode, setMode } = useThemeMode();
  return (
    <section className="ps-glass h-full" data-paper aria-labelledby="appearance-title">
      <h2 id="appearance-title" className="ps-cardtitle">
        Appearance
      </h2>
      <p className="ps-caption mt-1">Choose how Presenta looks on this device.</p>
      <PillTabs
        variant="segmented"
        className="mt-4"
        ariaLabel="Colour mode"
        value={mode}
        onChange={(id) => setMode(id as ThemeMode)}
        items={MODES.map((m) => ({
          id: m.id,
          label: (
            <span className="inline-flex items-center gap-1.5">
              <m.icon size={14} weight="light" aria-hidden /> {m.label}
            </span>
          ),
        }))}
      />
    </section>
  );
}
