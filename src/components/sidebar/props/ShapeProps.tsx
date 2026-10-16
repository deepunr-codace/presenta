"use client";

import type { ShapeElement, Theme } from "@/lib/deck/schema";
import type { ElementPatch } from "@/store/deck-store";
import { NumInput } from "@/components/ui-kit/NumInput";
import { PropertyGroup } from "@/components/ui-kit/PropertyGroup";
import { PropertyRow } from "@/components/ui-kit/PropertyRow";
import { Segmented } from "@/components/ui-kit/Segmented";
import { opts } from "@/components/ui-kit/options";
import { ColorField } from "../ColorField";

type Props = { el: ShapeElement; theme: Theme; patch: (p: ElementPatch) => void };

/** Shape kind, fill, stroke, stroke width and radius. */
export function ShapeProps({ el, theme, patch }: Props) {
  return (
    <PropertyGroup title="Shape">
      <PropertyRow label="Kind">
        <Segmented aria-label="Shape kind" value={el.kind} options={opts(["rect", "ellipse", "pill", "line"] as const, { rect: "Rect" })} onChange={(kind) => patch({ kind })} />
      </PropertyRow>
      <PropertyRow label="Fill">
        <ColorField label="Fill" value={el.fill} theme={theme} onChange={(fill) => patch({ fill: fill ?? "accent" })} />
        <span className="ps-caption truncate">{el.fill}</span>
      </PropertyRow>
      <PropertyRow label="Stroke">
        <ColorField label="Stroke" value={el.stroke} theme={theme} allowEmpty emptyLabel="None" onChange={(stroke) => patch({ stroke })} />
        <span className="ps-caption truncate">{el.stroke ?? "None"}</span>
      </PropertyRow>
      <PropertyRow label="Stroke width">
        <NumInput aria-label="Stroke width" value={el.strokeWidth} min={0} max={64} onCommit={(strokeWidth) => patch({ strokeWidth })} />
      </PropertyRow>
      <PropertyRow label="Radius">
        <NumInput aria-label="Corner radius" value={el.radius} min={0} disabled={el.kind !== "rect"} onCommit={(radius) => patch({ radius: Math.max(0, radius) })} />
      </PropertyRow>
    </PropertyGroup>
  );
}
