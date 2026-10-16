import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  value: ReactNode;
  unit?: ReactNode;
  caption?: ReactNode;
  size?: "md" | "lg";
  className?: string;
  ariaLabel?: string;
};

/** Stat value: Inter 300 at 32 px, tabular, with a 13 px unit and an optional caption (`.ps-numeral`). */
export function Numeral({ value, unit, caption, size = "md", className, ariaLabel }: Props) {
  return (
    <div className={cn("ps-numeral-wrap", className)}>
      <div className={cn("ps-numeral", size === "lg" && "ps-numeral-lg")} aria-label={ariaLabel}>
        <span className="min-w-0 max-w-full">{value}</span>
        {unit ? <span className="ps-unit">{unit}</span> : null}
      </div>
      {caption ? <p className="ps-cardcaption">{caption}</p> : null}
    </div>
  );
}
