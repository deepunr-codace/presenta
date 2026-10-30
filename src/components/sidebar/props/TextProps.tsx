"use client";

import { AlignBottom, AlignCenterVertical, AlignTop, TextAlignCenter, TextAlignLeft, TextAlignRight } from "@phosphor-icons/react";
import { TYPE_SCALE } from "@/lib/deck/layouts";
import { TextRoleSchema, type TextElement, type Theme } from "@/lib/deck/schema";
import type { ElementPatch } from "@/store/deck-store";
import { NumInput } from "@/components/ui-kit/NumInput";
import { PropertyGroup } from "@/components/ui-kit/PropertyGroup";
import { PropertyRow } from "@/components/ui-kit/PropertyRow";
import { Segmented } from "@/components/ui-kit/Segmented";
import { SelectInput } from "@/components/ui-kit/SelectInput";
import { SwitchRow } from "@/components/ui-kit/SwitchRow";
import { opts } from "@/components/ui-kit/options";
import { ColorField } from "../ColorField";

const WEIGHTS = ["default", "300", "400", "500", "600", "700"] as const;
const WEIGHT_LABELS = { default: "Theme default", "300": "Light 300", "400": "Regular 400", "500": "Medium 500", "600": "Semibold 600", "700": "Bold 700" } as const;
const FAMILIES = [
  { value: "default", label: "Theme default" },
  { value: "display", label: "Display" },
  { value: "body", label: "Body" },
] as const;

type Props = { el: TextElement; theme: Theme; patch: (p: ElementPatch) => void };

/** Text role, font, size, weight, colour, alignment, line height and auto-fit. */
export function TextProps({ el, theme, patch }: Props) {
  const setStyle = (s: Partial<TextElement["style"]>) => patch({ style: { ...el.style, ...s } });
  const weight = el.style.fontWeight ? String(el.style.fontWeight) : "default";
  return (
    <PropertyGroup title="Text">
      <PropertyRow label="Role">
        <SelectInput aria-label="Text role" value={el.role} options={opts(TextRoleSchema.options)} onChange={(role) => patch({ role })} />
      </PropertyRow>
      <PropertyRow label="Font">
        <SelectInput aria-label="Font family" value={el.style.fontFamily ?? "default"} options={FAMILIES} onChange={(v) => setStyle({ fontFamily: v === "default" ? undefined : v })} />
      </PropertyRow>
      <PropertyRow label="Size">
        <NumInput aria-label="Font size" value={el.style.fontSize ?? TYPE_SCALE[el.role]} min={8} max={400} onCommit={(fontSize) => setStyle({ fontSize })} />
        <span className="ps-caption">px</span>
      </PropertyRow>
      <PropertyRow label="Weight">
        <SelectInput aria-label="Font weight" value={(WEIGHTS as readonly string[]).includes(weight) ? weight : "default"} options={opts(WEIGHTS, WEIGHT_LABELS)} onChange={(w) => setStyle({ fontWeight: w === "default" ? undefined : Number(w) })} />
      </PropertyRow>
      <PropertyRow label="Colour">
        <ColorField label="Text colour" value={el.style.color} theme={theme} allowEmpty emptyLabel="Theme ink" onChange={(color) => setStyle({ color })} />
        <span className="ps-caption truncate">{el.style.color ?? "Theme ink"}</span>
      </PropertyRow>
      <PropertyRow label="Align">
        <Segmented
          aria-label="Text alignment"
          value={el.align}
          onChange={(align) => patch({ align })}
          options={[
            { value: "left", label: <TextAlignLeft size={14} />, title: "Left" },
            { value: "center", label: <TextAlignCenter size={14} />, title: "Centre" },
            { value: "right", label: <TextAlignRight size={14} />, title: "Right" },
          ]}
        />
      </PropertyRow>
      <PropertyRow label="Vertical">
        <Segmented
          aria-label="Vertical alignment"
          value={el.valign}
          onChange={(valign) => patch({ valign })}
          options={[
            { value: "top", label: <AlignTop size={14} />, title: "Top" },
            { value: "middle", label: <AlignCenterVertical size={14} />, title: "Middle" },
            { value: "bottom", label: <AlignBottom size={14} />, title: "Bottom" },
          ]}
        />
      </PropertyRow>
      <PropertyRow label="Line height">
        <NumInput aria-label="Line height" value={el.style.lineHeight} placeholder="Auto" min={0} max={4} step={0.05} digits={2} onCommit={(v) => setStyle({ lineHeight: v > 0 ? v : undefined })} />
      </PropertyRow>
      <SwitchRow label="Auto-fit" checked={el.autoFit} onChange={(autoFit) => patch({ autoFit })} />
    </PropertyGroup>
  );
}
