import type { LayoutId } from "@/lib/deck/schema";
import { cn } from "@/lib/utils";

type BoxKind = "title" | "text" | "block" | "image" | "accent";
/** Percent-based boxes inside a 16:9 schematic. */
type Box = [kind: BoxKind, x: number, y: number, w: number, h: number];

const rows = (x: number, y: number, w: number, n: number, kind: BoxKind = "text"): Box[] => Array.from({ length: n }, (_, i): Box => [kind, x, y + i * 12, w - i * 6, 6]);

const cards = (n: number, y: number, h: number, kind: BoxKind = "block"): Box[] => {
  const gap = 3;
  const w = (84 - gap * (n - 1)) / n;
  return Array.from({ length: n }, (_, i): Box => [kind, 8 + i * (w + gap), y, w, h]);
};

const SCHEMATICS: Record<LayoutId, Box[]> = {
  cover: [["accent", 8, 44, 12, 3], ["title", 8, 54, 62, 12], ["text", 8, 72, 44, 6]],
  section: [["accent", 8, 30, 10, 3], ["title", 8, 40, 56, 12], ["text", 8, 58, 40, 6]],
  "title-bullets": [["title", 8, 10, 60, 10], ...rows(8, 32, 56, 3)],
  "two-column": [["title", 8, 10, 60, 10], ...rows(8, 32, 38, 3), ...rows(54, 32, 38, 3)],
  "three-cards": [["title", 8, 10, 60, 10], ...cards(3, 32, 52)],
  "four-cards": [["title", 8, 10, 60, 10], ...cards(4, 32, 52)],
  "stats-row": [["title", 8, 10, 60, 10], ...cards(4, 40, 16, "title"), ...cards(4, 62, 6, "text")],
  quote: [["accent", 44, 26, 12, 4], ["title", 20, 38, 60, 10], ["title", 26, 52, 48, 10], ["text", 40, 70, 20, 5]],
  "image-left": [["image", 8, 12, 38, 76], ["title", 52, 20, 40, 10], ...rows(52, 40, 40, 3)],
  "image-right": [["title", 8, 20, 40, 10], ...rows(8, 40, 40, 3), ["image", 54, 12, 38, 76]],
  "process-steps": [["title", 8, 10, 60, 10], ...cards(4, 34, 46)],
  comparison: [["title", 8, 10, 60, 10], ["block", 8, 30, 41, 58], ["block", 51, 30, 41, 58]],
  closing: [["title", 20, 36, 60, 12], ["text", 30, 54, 40, 6], ["accent", 40, 68, 20, 8]],
  blank: [],
};

const BOX_STYLE: Record<BoxKind, string> = {
  title: "var(--ps-ink)",
  text: "var(--ps-ash)",
  block: "var(--ps-line-2)",
  image: "var(--ps-line-2)",
  accent: "var(--ps-graphite)",
};

type Props = { id: LayoutId; className?: string };

/** Tiny 16:9 wireframe of a layout, drawn with chrome tokens. */
export function LayoutSchematic({ id, className }: Props) {
  return (
    <div className={cn("relative aspect-video w-full overflow-hidden rounded-[var(--ps-r-sm)] bg-[var(--ps-plate)]", className)} aria-hidden>
      {SCHEMATICS[id].map(([kind, x, y, w, h], i) => (
        <div key={i} className={cn("absolute rounded-[1px]", kind === "image" && "rounded-[2px]")} style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%`, background: BOX_STYLE[kind] }} />
      ))}
    </div>
  );
}
