"use client";

import { createElement } from "react";
import type { IconElement } from "@/lib/deck/schema";
import { resolveColor, resolveIcon } from "./tokens";

type Props = { element: IconElement };

/** A Phosphor icon sized to the smaller side of its box. */
export function IconView({ element }: Props) {
  const size = Math.min(element.w, element.h);
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {createElement(resolveIcon(element.name), { size, weight: element.weight, color: resolveColor(element.color, "var(--deck-accent)") })}
    </div>
  );
}
