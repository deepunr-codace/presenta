import type { ReactNode } from "react";

type Props = {
  icon: ReactNode;
  title: string;
  value: string;
  unit?: string;
  caption: string;
};

/** Stat tile (DESIGN.md §5): 12 px label with a 14 px icon, 24/28 semibold value, 11 px caption. */
export function ReviewStatCard({ icon, title, value, unit, caption }: Props) {
  return (
    <div className="ps-stat">
      <div className="ps-stat-label">
        <span aria-hidden>{icon}</span>
        {title}
      </div>
      <div className="ps-stat-value" aria-label={`${title}: ${value}${unit ? ` ${unit}` : ""}`}>
        <span>{value}</span>
        {unit ? <span className="ps-stat-unit">{unit}</span> : null}
      </div>
      <p className="ps-stat-caption">{caption}</p>
    </div>
  );
}
