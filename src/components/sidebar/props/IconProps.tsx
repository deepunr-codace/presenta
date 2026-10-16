"use client";

import type { IconElement, Theme } from "@/lib/deck/schema";
import type { ElementPatch } from "@/store/deck-store";
import { PropertyGroup } from "@/components/ui-kit/PropertyGroup";
import { PropertyRow } from "@/components/ui-kit/PropertyRow";
import { SelectInput } from "@/components/ui-kit/SelectInput";
import { opts } from "@/components/ui-kit/options";
import { ColorField } from "../ColorField";
import { IconPicker } from "../IconPicker";

const ICON_WEIGHTS = ["thin", "light", "regular", "bold", "fill", "duotone"] as const;

type Props = { el: IconElement; theme: Theme; patch: (p: ElementPatch) => void };

/** Icon name, colour and weight. */
export function IconProps({ el, theme, patch }: Props) {
  return (
    <PropertyGroup title="Icon">
      <PropertyRow label="Icon">
        <IconPicker label="Icon" value={el.name} onChange={(name) => name && patch({ name })} />
      </PropertyRow>
      <PropertyRow label="Colour">
        <ColorField label="Icon colour" value={el.color} theme={theme} onChange={(color) => patch({ color: color ?? "accent" })} />
        <span className="ps-caption truncate">{el.color}</span>
      </PropertyRow>
      <PropertyRow label="Weight">
        <SelectInput aria-label="Icon weight" value={el.weight} options={opts(ICON_WEIGHTS)} onChange={(weight) => patch({ weight })} />
      </PropertyRow>
    </PropertyGroup>
  );
}
