import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  /** Right-aligned controls in the group head. */
  action?: ReactNode;
  className?: string;
  children: ReactNode;
};

/** Sidebar property group: 13 px title row, then rows separated by hairlines (`.ps-group`). */
export function PropertyGroup({ title, action, className, children }: Props) {
  return (
    <section className={cn("ps-group", className)}>
      <div className="ps-group-head">
        <h3 className="ps-group-title">{title}</h3>
        {action}
      </div>
      <div className="ps-rows">{children}</div>
    </section>
  );
}
