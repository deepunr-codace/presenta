"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type PillTab = {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  /** Shown but not selectable; `hint` explains why (for example "Coming soon"). */
  disabled?: boolean;
  hint?: string;
};

type Props = {
  items: PillTab[];
  value: string;
  onChange: (id: string) => void;
  /** Underline tabs for page sections (default) or a joined segmented control for view toggles. */
  variant?: "underline" | "segmented";
  className?: string;
  ariaLabel?: string;
};

/** Tabs (`.ps-tabs`): 32 px underline tabs, or a 28 px segmented control with `variant="segmented"`. Disabled tabs keep a tooltip. */
export function PillTabs({ items, value, onChange, variant = "underline", className, ariaLabel = "View" }: Props) {
  return (
    <div className={cn("ps-tabs", className)} role="tablist" aria-label={ariaLabel} data-variant={variant === "segmented" ? "segmented" : undefined}>
      {items.map((t) => {
        const on = t.id === value;
        const tab = (
          <button
            key={t.id}
            type="button"
            role="tab"
            className="ps-tab"
            aria-selected={on}
            aria-disabled={t.disabled || undefined}
            data-active={on ? "" : undefined}
            onClick={(e) => {
              if (t.disabled) {
                e.preventDefault();
                return;
              }
              if (!on) onChange(t.id);
            }}
          >
            {t.icon}
            {t.label}
          </button>
        );
        if (!t.hint) return tab;
        return (
          <Tooltip key={t.id}>
            <TooltipTrigger render={tab} />
            <TooltipContent side="bottom">{t.hint}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
