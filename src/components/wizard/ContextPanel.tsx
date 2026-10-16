"use client";

import { getTheme } from "@/lib/deck/themes";
import { cn } from "@/lib/utils";
import { BrandPreview } from "./BrandPreview";
import { ContextCard } from "./ContextCard";
import { ContextRow } from "./ContextRow";
import { SettingsFields } from "./SettingsFields";
import { FONT_PAIRS } from "./brand-options";
import { useWizardStore } from "./wizard-state";

function cap(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

type Props = { className?: string };

/** Right column: what is known so far. Settings are editable during Brief and Outline; Brand shows the live cover preview. */
export function ContextPanel({ className }: Props) {
  const step = useWizardStore((s) => s.step);
  const mode = useWizardStore((s) => s.mode);
  const brief = useWizardStore((s) => s.brief);
  const settings = useWizardStore((s) => s.settings);
  const outline = useWizardStore((s) => s.outline);
  const themeId = useWizardStore((s) => s.themeId);
  const brand = useWizardStore((s) => s.brand);
  const settingsEditable = step === "brief" || step === "outline";

  return (
    <aside className={cn("space-y-4", className)} aria-label="Summary">
      {step === "brand" ? (
        <ContextCard title="Preview">
          <BrandPreview />
        </ContextCard>
      ) : null}

      <ContextCard title="Brief">
        <dl className="space-y-2">
          <ContextRow label="Source" value={mode === "chat" ? "Conversation" : mode === "paste" ? "Pasted content" : undefined} placeholder="Not chosen" />
          {mode === "paste" ? <ContextRow label="Content" value={brief.source ? `${brief.source.length.toLocaleString()} characters` : undefined} /> : <ContextRow label="Topic" value={brief.topic} />}
          <ContextRow label="Audience" value={brief.audience} />
          <ContextRow label="Goal" value={brief.goal} />
          <ContextRow label="Must include" value={brief.mustInclude?.length ? brief.mustInclude.join(" · ") : undefined} />
          {mode !== "paste" ? <ContextRow label="Angle" value={brief.angle} /> : null}
        </dl>
      </ContextCard>

      <ContextCard title="Settings">
        {settingsEditable ? (
          <SettingsFields />
        ) : (
          <dl className="space-y-2">
            <ContextRow label="Slides" value={String(settings.slideCount)} />
            <ContextRow label="Tone" value={cap(settings.tone)} />
            <ContextRow label="Language" value={settings.language} />
          </dl>
        )}
      </ContextCard>

      {outline && step !== "outline" ? (
        <ContextCard title="Outline">
          <dl className="space-y-2">
            <ContextRow label="Title" value={outline.title} />
            <ContextRow label="Slides" value={`${outline.slides.length} slides`} />
          </dl>
        </ContextCard>
      ) : null}

      {step === "generate" ? (
        <ContextCard title="Brand">
          <dl className="space-y-2">
            <ContextRow label="Theme" value={getTheme(themeId).name} />
            <ContextRow label="Company" value={brand.company} />
            <ContextRow label="Accent" value={brand.accent ? brand.accent.toUpperCase() : "Theme default"} />
            <ContextRow label="Fonts" value={brand.fontPair ? FONT_PAIRS.find((f) => f.id === brand.fontPair)?.label : "Theme default"} />
            <ContextRow label="Logo" value={brand.logoDataUrl ? "Uploaded" : undefined} placeholder="None" />
          </dl>
        </ContextCard>
      ) : null}
    </aside>
  );
}
