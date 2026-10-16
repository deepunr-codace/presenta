"use client";

import { Copy, Trash } from "@phosphor-icons/react";
import { useDeckStore } from "@/store/deck-store";
import { PropertyGroup } from "@/components/ui-kit/PropertyGroup";

type Props = { slideId: string; ids: string[] };

/** Design tab head when several elements are selected: duplicate or delete them together. */
export function MultiSelectionProps({ slideId, ids }: Props) {
  const deleteElements = useDeckStore((s) => s.deleteElements);
  const duplicateElements = useDeckStore((s) => s.duplicateElements);
  return (
    <PropertyGroup title={`${ids.length} elements selected`}>
      <div className="flex gap-1.5">
        <button type="button" className="ps-btn" onClick={() => duplicateElements(slideId, ids)}>
          <Copy size={12} /> Duplicate
        </button>
        <button type="button" className="ps-btn" data-danger="true" onClick={() => deleteElements(slideId, ids)}>
          <Trash size={12} /> Delete
        </button>
      </div>
      <p className="ps-caption">Select a single element to edit its properties.</p>
    </PropertyGroup>
  );
}
