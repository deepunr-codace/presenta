"use client";

import { FIELD } from "@/lib/styles";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { LANGUAGES, TONES, isTone, useWizardStore } from "./wizard-state";

const TONE_ITEMS: Record<string, string> = Object.fromEntries(TONES.map((t) => [t, t[0].toUpperCase() + t.slice(1)]));

/** Slides, tone and language; editable during Brief and Outline. */
export function SettingsFields() {
  const settings = useWizardStore((s) => s.settings);
  const patch = useWizardStore((s) => s.patchSettings);
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label htmlFor="wizard-slides" className="ps-label text-[13px] leading-[18px]">
            Slides
          </Label>
          <span className="text-[13px] font-medium tabular-nums text-[var(--ps-ink)]">{settings.slideCount}</span>
        </div>
        <Slider
          id="wizard-slides"
          min={3}
          max={20}
          step={1}
          value={[settings.slideCount]}
          onValueChange={(v) => {
            const n = Array.isArray(v) ? v[0] : v;
            if (typeof n === "number") patch({ slideCount: n });
          }}
          className="[&_[data-slot=slider-range]]:bg-[var(--ps-ink)] [&_[data-slot=slider-thumb]]:border-[var(--ps-ink)] [&_[data-slot=slider-track]]:bg-[var(--ps-plate)]"
        />
        <div className="ps-caption mt-1 flex justify-between">
          <span>3</span>
          <span>20</span>
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="wizard-tone" className="ps-label text-[13px] leading-[18px]">
          Tone
        </Label>
        <Select value={settings.tone} items={TONE_ITEMS} onValueChange={(v) => isTone(v) && patch({ tone: v })}>
          <SelectTrigger id="wizard-tone" className={cn(FIELD, "h-9 w-full")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TONES.map((t) => (
              <SelectItem key={t} value={t}>
                {TONE_ITEMS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="wizard-language" className="ps-label text-[13px] leading-[18px]">
          Language
        </Label>
        <Select value={settings.language} onValueChange={(v) => typeof v === "string" && patch({ language: v })}>
          <SelectTrigger id="wizard-language" className={cn(FIELD, "h-9 w-full")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
