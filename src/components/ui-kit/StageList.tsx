import { Check } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type Props = {
  stages: readonly string[];
  /** Index of the running stage; stages before it are done. Pass `stages.length` when all are done. */
  active: number;
  /** Stack vertically on small screens and lay out in columns from `sm` up. */
  columns?: boolean;
  className?: string;
};

/** Ordered list of pipeline stages with done, active and upcoming markers. */
export function StageList({ stages, active, columns = false, className }: Props) {
  return (
    <ol className={cn("flex flex-col gap-3", columns ? "sm:grid sm:grid-cols-4 sm:gap-4" : "sm:flex-row sm:items-center sm:gap-6", className)}>
      {stages.map((name, i) => {
        const state = i < active ? "done" : i === active ? "active" : "todo";
        return (
          <li key={name} className={cn("flex items-center gap-2.5 text-[12px]", columns && "sm:flex-col sm:items-start sm:gap-2")}>
            <span className="ps-stage-mark" data-state={state} aria-hidden>
              {state === "done" ? <Check size={11} weight="bold" /> : state === "active" ? <span className="size-2 animate-pulse rounded-full bg-[var(--ps-ink)]" /> : <span className="size-1.5 rounded-full bg-[var(--ps-line-2)]" />}
            </span>
            <span className={cn(state === "todo" ? "text-[var(--ps-ash)]" : "text-[var(--ps-ink)]", state === "active" && "font-medium")}>{name}</span>
          </li>
        );
      })}
    </ol>
  );
}
