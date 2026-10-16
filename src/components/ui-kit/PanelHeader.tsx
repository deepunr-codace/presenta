import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  title: ReactNode;
  /** Right-aligned element (count, button). */
  action?: ReactNode;
  className?: string;
};

/** 12 px semibold title on a 20 px row with a hairline below (`.ps-panel-header`). */
export function PanelHeader({ title, action, className }: Props) {
  return (
    <div className={cn("ps-panel-header", className)}>
      <span>{title}</span>
      {action ? <span className="ps-panel-action">{action}</span> : null}
    </div>
  );
}
