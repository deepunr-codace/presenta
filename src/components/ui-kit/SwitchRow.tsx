"use client";

import { Switch } from "@/components/ui/switch";
import { PropertyRow } from "./PropertyRow";

type Props = {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
};

/** Property row with a small switch as its control. */
export function SwitchRow({ label, checked, onChange }: Props) {
  return (
    <PropertyRow label={label}>
      <Switch size="sm" checked={checked} onCheckedChange={onChange} aria-label={label} />
    </PropertyRow>
  );
}
