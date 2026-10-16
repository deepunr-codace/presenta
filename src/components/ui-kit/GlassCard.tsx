import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { IconChip } from "./IconChip";

export type GlassCardProps = Omit<HTMLAttributes<HTMLElement>, "title"> & {
  /** Grid column span, written as `data-span` for a parent grid that reads it. */
  span?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  rowSpan?: 1 | 2 | 3;
  /** Line icon rendered in a 24 px icon chip at the top-left. */
  icon?: ReactNode;
  title?: ReactNode;
  /** Element at the top-right, usually a small button or menu. */
  action?: ReactNode;
  /** Paper variant: canvas fill with a 1 px line, for cards on a taupe band. */
  paper?: boolean;
  /** Wide hero card: 24 px radius and 32 px padding. */
  hero?: boolean;
  /** Pointer cursor and hover lift; set automatically when `onClick` is passed. */
  clickable?: boolean;
  headClassName?: string;
  as?: "section" | "article" | "div" | "li";
};

/** Card: taupe surface, 20 px radius, 24 px padding, no border; `paper` gives the outlined paper variant. */
export function GlassCard({ span, rowSpan, icon, title, action, paper = false, hero = false, clickable = false, headClassName, className, style, children, as: Tag = "section", ...rest }: GlassCardProps) {
  const hasHead = Boolean(icon || title || action);
  const interactive = clickable || Boolean(rest.onClick);
  const gridStyle: CSSProperties | undefined = rowSpan ? { gridRow: `span ${rowSpan}`, ...style } : style;
  return (
    <Tag className={cn("ps-glass", className)} data-span={span} data-paper={paper ? "" : undefined} data-hero={hero ? "" : undefined} data-clickable={interactive ? "" : undefined} style={gridStyle} {...rest}>
      {hasHead ? (
        <header className={cn("ps-glass-head", headClassName)}>
          {icon ? <IconChip icon={icon} /> : null}
          {title ? <h3 className="ps-label min-w-0 line-clamp-2">{title}</h3> : null}
          {action ? <div className="ps-glass-action">{action}</div> : null}
        </header>
      ) : null}
      {children}
    </Tag>
  );
}
