"use client";

import { CardVariantSchema, type CardElement } from "@/lib/deck/schema";
import type { ElementPatch } from "@/store/deck-store";
import { PropertyGroup } from "@/components/ui-kit/PropertyGroup";
import { PropertyRow } from "@/components/ui-kit/PropertyRow";
import { Segmented } from "@/components/ui-kit/Segmented";
import { TextAreaInput } from "@/components/ui-kit/TextAreaInput";
import { TextInput } from "@/components/ui-kit/TextInput";
import { opts } from "@/components/ui-kit/options";
import { IconPicker } from "../IconPicker";

type Props = { el: CardElement; patch: (p: ElementPatch) => void };

/** Card variant, title, body, icon, value and index. */
export function CardProps({ el, patch }: Props) {
  return (
    <PropertyGroup title="Card">
      <PropertyRow label="Variant">
        <Segmented aria-label="Card variant" value={el.variant} options={opts(CardVariantSchema.options)} onChange={(variant) => patch({ variant })} />
      </PropertyRow>
      <PropertyRow label="Title" stacked>
        <TextInput aria-label="Card title" value={el.title} maxLength={50} onCommit={(title) => patch({ title })} />
      </PropertyRow>
      <PropertyRow label="Body" stacked>
        <TextAreaInput aria-label="Card body" value={el.body} rows={3} onCommit={(body) => patch({ body })} />
      </PropertyRow>
      <PropertyRow label="Icon">
        <IconPicker label="Card icon" value={el.icon} allowEmpty onChange={(icon) => patch({ icon })} />
      </PropertyRow>
      <PropertyRow label="Value">
        <TextInput aria-label="Card value" value={el.value ?? ""} placeholder="Big figure, e.g. 42%" maxLength={14} onCommit={(value) => patch({ value: value || undefined })} />
      </PropertyRow>
      <PropertyRow label="Index">
        <TextInput aria-label="Card index" value={el.index ?? ""} placeholder="01" maxLength={4} onCommit={(index) => patch({ index: index || undefined })} />
      </PropertyRow>
    </PropertyGroup>
  );
}
