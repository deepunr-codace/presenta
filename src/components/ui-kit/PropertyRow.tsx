import type { ReactNode } from "react";

type Props = {
  label: string;
  children: ReactNode;
  /** Label above the control instead of beside it (long text fields, pickers). */
  stacked?: boolean;
  htmlFor?: string;
};

/** Property row: 12 px label left and the control right, 36 px tall (`.ps-row`); `stacked` puts the label above. */
export function PropertyRow({ label, children, stacked = false, htmlFor }: Props) {
  if (stacked) {
    return (
      <div className="ps-row-wide">
        <span className="ps-row-label">{label}</span>
        {children}
      </div>
    );
  }
  return (
    <div className="ps-row">
      <label className="ps-row-label" htmlFor={htmlFor} title={label}>
        {label}
      </label>
      <div className="flex min-w-0 items-center gap-1.5">{children}</div>
    </div>
  );
}
