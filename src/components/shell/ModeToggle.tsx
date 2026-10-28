"use client";

import { Moon, Sun } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useThemeMode } from "./ThemeMode";

type Props = {
  side?: "right" | "bottom";
};

/** Sun/moon ghost icon button toggling light and dark; the choice persists in `presenta:theme`. */
export function ModeToggle({ side = "bottom" }: Props) {
  const { resolved, setMode } = useThemeMode();
  const next = resolved === "dark" ? "light" : "dark";
  const label = `Switch to ${next} mode`;
  return (
    <Tooltip>
      <TooltipTrigger render={<button type="button" />} className="ps-iconbtn" aria-label={label} aria-pressed={resolved === "dark"} onClick={() => setMode(next)}>
        {resolved === "dark" ? <Sun size={16} strokeWidth={1.75} /> : <Moon size={16} strokeWidth={1.75} />}
      </TooltipTrigger>
      <TooltipContent side={side} sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
