import type { ShapeElement } from "@/lib/deck/schema";
import { resolveColor } from "./tokens";

type Props = { element: ShapeElement };

/** Rectangle, ellipse, pill or line with a token or CSS colour fill and optional stroke. */
export function ShapeView({ element }: Props) {
  const fill = resolveColor(element.fill, "var(--deck-accent)");
  const border = element.stroke && element.strokeWidth > 0 ? `${element.strokeWidth}px solid ${resolveColor(element.stroke)}` : undefined;
  const radius = element.kind === "ellipse" ? "50%" : element.kind === "pill" || element.kind === "line" ? 9999 : element.radius;
  return <div style={{ width: "100%", height: "100%", background: fill, border, borderRadius: radius, boxSizing: "border-box" }} />;
}
