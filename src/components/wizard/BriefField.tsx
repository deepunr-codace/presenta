"use client";

import { FIELD } from "@/lib/styles";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  id: string;
  label: string;
  value: string;
  max: number;
  onChange: (v: string) => void;
  placeholder?: string;
};

/** Labelled single-line field in the brief summary card. */
export function BriefField({ id, label, value, max, onChange, placeholder }: Props) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="ps-label text-[13px] leading-[18px]">
        {label}
      </Label>
      <Input id={id} value={value} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={cn(FIELD, "h-9")} />
    </div>
  );
}
