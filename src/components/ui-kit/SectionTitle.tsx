import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  title: ReactNode;
  /** Short caption after or under the title. */
  caption?: ReactNode;
  /** Right-aligned element (button, count). */
  action?: ReactNode;
  /** Heading level; defaults to h2. */
  as?: "h2" | "h3";
  className?: string;
};

/** Section title row: 20 px title, caption in ash, optional action on the right. */
export function SectionTitle({ title, caption, action, as: Tag = "h2", className }: Props) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3", className)}>
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        <Tag className="ps-section">{title}</Tag>
        {caption ? <span className="ps-caption">{caption}</span> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
