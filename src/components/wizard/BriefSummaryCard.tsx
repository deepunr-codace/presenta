"use client";

import { ArrowRight } from "@phosphor-icons/react";
import type { Brief } from "@/lib/deck/schema";
import { PRIMARY_BTN } from "@/lib/styles";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PanelHeader } from "@/components/ui-kit/PanelHeader";
import { BriefField } from "./BriefField";
import { ChipEditor } from "./ChipEditor";

type Props = {
  brief: Brief;
  onChange: (patch: Partial<Brief>) => void;
  onBuildOutline: () => void;
};

/** Editable summary of the brief shown when the conversation reaches "confirm". */
export function BriefSummaryCard({ brief, onChange, onBuildOutline }: Props) {
  const ready = Boolean(brief.topic?.trim());
  return (
    <div className="ps-tile mt-2 p-4">
      <PanelHeader title="Brief" />
      <div className="grid gap-3">
        <BriefField id="brief-topic" label="Topic" value={brief.topic ?? ""} max={300} onChange={(v) => onChange({ topic: v })} />
        <BriefField id="brief-audience" label="Audience" value={brief.audience ?? ""} max={120} onChange={(v) => onChange({ audience: v })} />
        <BriefField id="brief-goal" label="Goal" value={brief.goal ?? ""} max={200} onChange={(v) => onChange({ goal: v })} placeholder="Optional" />
        <div className="grid gap-1.5">
          <Label className="ps-label text-[13px] leading-[18px]">Must include</Label>
          <ChipEditor value={brief.mustInclude ?? []} onChange={(v) => onChange({ mustInclude: v })} max={10} maxLength={120} size="sm" placeholder="Add a point" ariaLabel="Must include" />
        </div>
        <BriefField id="brief-angle" label="Angle" value={brief.angle ?? ""} max={200} onChange={(v) => onChange({ angle: v })} placeholder="Optional" />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="ps-caption">{ready ? "Looks good? Next we draft the slides." : "Add a topic to continue."}</p>
        <Button className={cn(PRIMARY_BTN, "h-9 px-4")} onClick={onBuildOutline} disabled={!ready}>
          Build outline <ArrowRight data-icon="inline-end" weight="bold" />
        </Button>
      </div>
    </div>
  );
}
