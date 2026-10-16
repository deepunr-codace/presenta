"use client";

import { Slider } from "@/components/ui/slider";
import { useDraft } from "./useDraft";

type Props = {
  /** 0..1 */
  value: number;
  onCommit: (n: number) => void;
  "aria-label"?: string;
};

/** Slider for a 0..1 value shown as a percentage; commits on release. */
export function PercentSlider({ value, onCommit, "aria-label": ariaLabel }: Props) {
  const [local, setLocal] = useDraft(Math.round(value * 100));
  return (
    <div className="flex w-full items-center gap-2">
      <Slider
        value={local}
        min={0}
        max={100}
        step={1}
        aria-label={ariaLabel}
        onValueChange={(v) => setLocal(Array.isArray(v) ? v[0] : v)}
        onValueCommitted={(v) => {
          const n = (Array.isArray(v) ? v[0] : v) / 100;
          if (n !== value) onCommit(n);
        }}
        className="flex-1"
      />
      <span className="ps-caption w-8 text-right tabular-nums">{local}%</span>
    </div>
  );
}
