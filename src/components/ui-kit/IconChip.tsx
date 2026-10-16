import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  icon: ReactNode;
  className?: string;
  /** Accessible name; without one the chip is decorative. */
  label?: string;
};

/** Icon plate: 32 px plate circle with a 16 px ink icon (`.ps-iconchip`). */
export function IconChip({ icon, className, label }: Props) {
  return (
    <span className={cn("ps-iconchip", className)} aria-hidden={label ? undefined : true} aria-label={label} role={label ? "img" : undefined}>
      {icon}
    </span>
  );
}
