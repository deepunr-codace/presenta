"use client";

import { ArrowLeft, Palette, Sparkle } from "@phosphor-icons/react";
import { useBrandKit } from "@/hooks/useBrandKit";
import { getTheme } from "@/lib/deck/themes";
import { PRIMARY_BTN, SECONDARY_BTN } from "@/lib/styles";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BrandFields } from "./BrandFields";
import { StepHeader } from "./StepHeader";
import { ThemeRadioGrid } from "./ThemeRadioGrid";
import { useWizardStore } from "./wizard-state";

/** Step 3. Theme and brand preferences; the live cover preview lives in the context panel. */
export function BrandStep() {
  const themeId = useWizardStore((s) => s.themeId);
  const brand = useWizardStore((s) => s.brand);
  const setThemeId = useWizardStore((s) => s.setThemeId);
  const patchBrand = useWizardStore((s) => s.patchBrand);
  const setStep = useWizardStore((s) => s.setStep);
  const kit = useBrandKit();

  const applyKit = () => {
    if (!kit) return;
    patchBrand({ company: kit.brand.company, logoDataUrl: kit.brand.logoDataUrl, accent: kit.brand.accent, fontPair: kit.brand.fontPair, notes: kit.brand.notes });
    if (kit.themeId) setThemeId(kit.themeId);
  };

  const themeAccent = getTheme(themeId).colors.accent;

  return (
    <div className="space-y-5">
      <StepHeader title="Brand" hint="Pick a theme, then adjust it to match your brand. The preview updates as you go." />

      {kit ? (
        <div className="ps-glass flex flex-wrap items-center justify-between gap-3" role="status">
          <p className="ps-body">You have a saved brand kit{kit.brand.company ? ` for ${kit.brand.company}` : ""}.</p>
          <Button variant="outline" size="sm" className={cn(SECONDARY_BTN, "h-8 px-3.5")} onClick={applyKit}>
            <Palette data-icon="inline-start" /> Apply brand kit
          </Button>
        </div>
      ) : null}

      <section aria-label="Theme" className="ps-glass">
        <h3 className="ps-label mb-4">Theme</h3>
        <ThemeRadioGrid value={themeId} onChange={setThemeId} />
      </section>

      <section aria-label="Preferences" className="ps-glass grid gap-5 sm:grid-cols-2">
        <BrandFields brand={brand} themeAccent={themeAccent} onPatch={patchBrand} />
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
