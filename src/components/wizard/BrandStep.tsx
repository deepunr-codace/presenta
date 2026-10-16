"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { ArrowLeft, Check, Sparkle, Trash, UploadSimple } from "@phosphor-icons/react";
import { FontPairSchema, type FontPair } from "@/lib/deck/schema";
import { getTheme } from "@/lib/deck/themes";
import { FIELD, GHOST_BTN, PRIMARY_BTN, SECONDARY_BTN } from "@/lib/styles";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StepHeader } from "./StepHeader";
import { ThemeRadioGrid } from "./ThemeRadioGrid";
import { ACCENT_PRESETS, FONT_ITEMS, FONT_PAIRS, LOGO_MAX_BYTES } from "./brand-options";
import { useWizardStore } from "./wizard-state";

function isFontPair(v: unknown): v is FontPair {
  return FontPairSchema.safeParse(v).success;
}

/** Step 3. Theme and brand preferences; the live cover preview lives in the context panel. */
export function BrandStep() {
  const themeId = useWizardStore((s) => s.themeId);
  const brand = useWizardStore((s) => s.brand);
  const setThemeId = useWizardStore((s) => s.setThemeId);
  const patchBrand = useWizardStore((s) => s.patchBrand);
  const setStep = useWizardStore((s) => s.setStep);
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onLogo = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/^image\/(png|svg\+xml|jpeg)$/.test(file.type)) {
      setLogoError("Use a PNG, SVG or JPG file.");
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      setLogoError("Keep the logo under 1 MB.");
      return;
    }
    setLogoError(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") patchBrand({ logoDataUrl: reader.result });
    };
    reader.onerror = () => setLogoError("Could not read that file.");
    reader.readAsDataURL(file);
  };

  const themeAccent = getTheme(themeId).colors.accent;

  return (
    <div className="space-y-5">
      <StepHeader title="Brand" hint="Pick a theme, then adjust it to match your brand. The preview updates as you go." />

      <section aria-label="Theme" className="ps-glass">
        <h3 className="ps-label mb-4">Theme</h3>
        <ThemeRadioGrid value={themeId} onChange={setThemeId} />
      </section>

      <section aria-label="Preferences" className="ps-glass grid gap-5 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="brand-company" className="ps-label text-[13px] leading-[18px]">
            Company name
          </Label>
          <Input id="brand-company" value={brand.company ?? ""} maxLength={80} placeholder="e.g. CodeAce" onChange={(e) => patchBrand({ company: e.target.value })} className={cn(FIELD, "h-9")} />
        </div>

        <div className="grid gap-1.5">
          <Label className="ps-label text-[13px] leading-[18px]">Logo</Label>
          <div className="flex items-center gap-3">
            <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-[var(--ps-r-sm)] border border-[var(--ps-line-2)] bg-[repeating-conic-gradient(var(--ps-plate)_0_25%,var(--ps-paper)_0_50%)] bg-[length:12px_12px]">
              {brand.logoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- data URL preview
                <img src={brand.logoDataUrl} alt="Logo preview" className="max-h-10 max-w-10 object-contain" />
              ) : (
                <UploadSimple size={16} className="text-[var(--ps-ash)]" />
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className={cn(SECONDARY_BTN, "h-8 px-3.5")} onClick={() => fileRef.current?.click()}>
                <UploadSimple data-icon="inline-start" /> {brand.logoDataUrl ? "Replace" : "Upload"}
              </Button>
              {brand.logoDataUrl ? (
                <Button variant="ghost" size="sm" className={cn(GHOST_BTN, "h-8 px-3")} onClick={() => patchBrand({ logoDataUrl: undefined })}>
                  <Trash data-icon="inline-start" /> Remove
                </Button>
              ) : null}
            </div>
            <input ref={fileRef} type="file" accept="image/png,image/svg+xml,image/jpeg" className="hidden" onChange={onLogo} />
          </div>
          <p className={cn("ps-caption", logoError && "text-[var(--ps-danger)]")} role={logoError ? "alert" : undefined}>
            {logoError ?? "PNG, SVG or JPG, under 1 MB."}
          </p>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="brand-accent" className="ps-label text-[13px] leading-[18px]">
            Accent colour
          </Label>
          <div className="grid w-full max-w-[320px] grid-cols-9 items-center justify-items-center gap-1.5" role="group" aria-label="Accent colour">
            <label className="ps-focus-within relative grid size-8 cursor-pointer place-items-center overflow-hidden rounded-full border border-[var(--ps-line-2)]" title="Custom colour">
              <input id="brand-accent" type="color" value={brand.accent ?? themeAccent} onChange={(e) => patchBrand({ accent: e.target.value })} className="absolute inset-0 size-full cursor-pointer opacity-0" aria-label="Custom accent colour" />
              <span className="size-full" style={{ background: brand.accent ?? themeAccent }} aria-hidden />
            </label>
            {ACCENT_PRESETS.map((hex) => {
              const on = brand.accent?.toUpperCase() === hex;
              return (
                <button key={hex} type="button" aria-label={`Accent ${hex}`} aria-pressed={on} onClick={() => patchBrand({ accent: hex })} className={cn("ps-focus grid size-7 place-items-center rounded-full ring-offset-2 ring-offset-[var(--ps-surface)] transition-shadow", on && "ring-2 ring-[var(--ps-ink)]")} style={{ background: hex }}>
                  {on ? <Check size={12} weight="bold" className="text-white" aria-hidden /> : null}
                </button>
              );
            })}
          </div>
          <p className="ps-caption flex items-center gap-2">
            <span className="font-mono">{brand.accent ? brand.accent.toUpperCase() : `Theme default ${themeAccent.toUpperCase()}`}</span>
            {brand.accent ? (
              <>
                <span aria-hidden>·</span>
                <button type="button" onClick={() => patchBrand({ accent: undefined })} className="ps-link text-[12px]">
                  Use theme default
                </button>
              </>
            ) : null}
          </p>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="brand-fonts" className="ps-label text-[13px] leading-[18px]">
            Font pair
          </Label>
          <Select value={brand.fontPair ?? "theme"} items={FONT_ITEMS} onValueChange={(v) => patchBrand({ fontPair: isFontPair(v) ? v : undefined })}>
            <SelectTrigger id="brand-fonts" className={cn(FIELD, "h-9 w-full")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="theme">Theme default</SelectItem>
              {FONT_PAIRS.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="brand-notes" className="ps-label text-[13px] leading-[18px]">
            Notes for the AI
          </Label>
          <Textarea id="brand-notes" value={brand.notes ?? ""} maxLength={400} rows={3} placeholder="Voice, words to avoid, anything the AI should respect" onChange={(e) => patchBrand({ notes: e.target.value })} className={cn(FIELD, "min-h-[72px] resize-none")} />
          <p className="ps-caption text-right tabular-nums">{(brand.notes ?? "").length} / 400</p>
        </div>
      </section>

      <footer className="flex items-center justify-between gap-3 pt-2">
        <Button variant="outline" className={cn(SECONDARY_BTN, "h-9 px-4")} onClick={() => setStep("outline")}>
          <ArrowLeft data-icon="inline-start" /> Back
        </Button>
        <Button className={cn(PRIMARY_BTN, "h-9 px-4")} onClick={() => setStep("generate")}>
          <Sparkle data-icon="inline-start" weight="fill" /> Generate slides
        </Button>
      </footer>
    </div>
  );
}
