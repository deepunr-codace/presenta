"use client";

import { AnimationEffectSchema, AnimationTriggerSchema, type Element, type ElementAnimation } from "@/lib/deck/schema";
import type { ElementPatch } from "@/store/deck-store";
import { NumInput } from "@/components/ui-kit/NumInput";
import { opts } from "@/components/ui-kit/options";
import { PropertyGroup } from "@/components/ui-kit/PropertyGroup";
import { PropertyRow } from "@/components/ui-kit/PropertyRow";
import { SelectInput } from "@/components/ui-kit/SelectInput";

type Props = { element: Element; patch: (p: ElementPatch) => void };

const EFFECT_LABELS = {
  none: "None",
  fade: "Fade in",
  "fly-up": "Fly up",
  "fly-down": "Fly down",
  "fly-left": "Fly from right",
  "fly-right": "Fly from left",
  zoom: "Zoom in",
  wipe: "Wipe",
} as const;

const TRIGGER_LABELS = {
  onClick: "On click",
  withPrevious: "With previous",
  afterPrevious: "After previous",
} as const;

const DEFAULT_ANIMATION: ElementAnimation = { effect: "fade", trigger: "onClick", duration: 0.5, delay: 0 };

/** Entrance animation played when the deck is presented: effect, when it triggers, duration and delay. */
export function MotionProps({ element, patch }: Props) {
  const animation = element.animation;
  const effect = animation?.effect ?? "none";

  const setAnimation = (p: Partial<ElementAnimation>) => patch({ animation: { ...DEFAULT_ANIMATION, ...animation, ...p } });

  return (
    <PropertyGroup title="Motion">
      <PropertyRow label="Effect">
        <SelectInput
          aria-label="Entrance effect"
          value={effect}
          options={opts(AnimationEffectSchema.options, EFFECT_LABELS)}
          onChange={(v) => (v === "none" ? patch({ animation: undefined }) : setAnimation({ effect: v }))}
        />
      </PropertyRow>
      {effect !== "none" ? (
        <>
          <PropertyRow label="Trigger">
            <SelectInput
              aria-label="Animation trigger"
              value={animation?.trigger ?? "onClick"}
              options={opts(AnimationTriggerSchema.options, TRIGGER_LABELS)}
              onChange={(trigger) => setAnimation({ trigger })}
            />
          </PropertyRow>
          <PropertyRow label="Duration">
            <NumInput aria-label="Animation duration" value={animation?.duration ?? 0.5} min={0.1} max={3} step={0.1} digits={1} onCommit={(duration) => setAnimation({ duration })} />
            <span className="ps-caption">s</span>
          </PropertyRow>
          <PropertyRow label="Delay">
            <NumInput aria-label="Animation delay" value={animation?.delay ?? 0} min={0} max={5} step={0.1} digits={1} onCommit={(delay) => setAnimation({ delay })} />
            <span className="ps-caption">s</span>
          </PropertyRow>
        </>
      ) : null}
    </PropertyGroup>
  );
}
