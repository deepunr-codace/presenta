import type { ReactNode } from "react";

type Props = {
  title: string;
  hint: string;
  /** Right-aligned action (for example "Regenerate outline"). */
  children?: ReactNode;
};

/** Step title (page title role) and hint used by every wizard step. */
export function StepHeader({ title, hint, children }: Props) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="ps-pagetitle">{title}</h2>
        <p className="ps-body-lg mt-2">{hint}</p>
      </div>
      {children}
    </header>
  );
}
