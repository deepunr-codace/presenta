import { cn } from "@/lib/utils";

type Props = {
  count: number;
  active: number;
  className?: string;
  /** When set the dots are buttons that select a page. */
  onSelect?: (i: number) => void;
};

/** Segmented dots for carousels and multi-step content (`.ps-dots`). */
export function Dots({ count, active, className, onSelect }: Props) {
  return (
    <div className={cn("ps-dots", className)} role={onSelect ? "tablist" : undefined} aria-label={onSelect ? "Pages" : undefined}>
      {Array.from({ length: count }, (_, i) =>
        onSelect ? (
          <button key={i} type="button" role="tab" aria-selected={i === active} aria-label={`Page ${i + 1}`} data-active={i === active ? "" : undefined} onClick={() => onSelect(i)} />
        ) : (
          <span key={i} data-active={i === active ? "" : undefined} aria-hidden />
        ),
      )}
    </div>
  );
}
