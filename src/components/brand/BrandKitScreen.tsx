"use client";

import { useState } from "react";
import { FloppyDisk, Trash } from "@phosphor-icons/react";
import { clearBrandKit, getBrandKit, isEmptyKit, saveBrandKit } from "@/lib/brand-kit";
import { useMounted } from "@/hooks/useBrandKit";
import type { Brand, ThemeId } from "@/lib/deck/schema";
import { getTheme } from "@/lib/deck/themes";
import { PRIMARY_BTN, SECONDARY_BTN } from "@/lib/styles";
import { cn } from "@/lib/utils";
import { AppShell } from "@/components/shell/AppShell";
import { useToast } from "@/components/shell/Toast";
import { Button } from "@/components/ui/button";
import { BrandFields } from "@/components/wizard/BrandFields";
import { ThemeRadioGrid } from "@/components/wizard/ThemeRadioGrid";

/** Theme shown as selected while no default is chosen (the wizard's own default). */
const DEFAULT_THEME_ID: ThemeId = "glass-contrast";

/** Brand kit at /brand: set the company, logo, colours, fonts, AI notes and default theme once; new decks start with them. */
export function BrandKitScreen() {
  const mounted = useMounted();
  return (
    <AppShell active="brand" sidebar="full" breadcrumbs={[{ label: "Studio", href: "/" }, { label: "Brand kit" }]}>
      <div className="ps-page">
        <header className="mb-8">
          <h1 className="ps-heading">Brand kit</h1>
          <p className="ps-body-lg mt-2">Set your brand once. Every new deck starts with it, and you can still change it per deck. Saved to your account.</p>
        </header>
        {mounted ? <BrandKitEditor /> : <div className="ps-glass h-64 animate-pulse" aria-hidden />}
      </div>
    </AppShell>
  );
}

function BrandKitEditor() {
  const { toast } = useToast();
  const [saved, setSaved] = useState(getBrandKit);
  const [brand, setBrand] = useState<Brand>(saved?.brand ?? {});
  const [themeId, setThemeId] = useState<ThemeId | undefined>(saved?.themeId);
  const [error, setError] = useState<string | null>(null);

  const patch = (p: Partial<Brand>) =>
    setBrand((prev) => {
      const next: Brand = { ...prev, ...p };
      for (const key of Object.keys(next) as (keyof Brand)[]) {
        const v = next[key];
        if (v === undefined || v === "") delete next[key];
      }
      return next;
    });

  const draftEmpty = isEmptyKit({ brand, themeId });
  const dirty = JSON.stringify({ brand, themeId }) !== JSON.stringify(saved ? { brand: saved.brand, themeId: saved.themeId } : { brand: {}, themeId: undefined });
  const shownTheme = themeId ?? DEFAULT_THEME_ID;

  const save = () => {
    try {
      saveBrandKit({ brand, themeId });
      setSaved(getBrandKit());
      setError(null);
      toast("Brand kit saved. New decks will start with it.", { tone: "success" });
    } catch {
      setError("Could not save the brand kit in this browser. A large logo may not fit; try a smaller one.");
    }
  };

  const clear = () => {
    clearBrandKit();
    setSaved(null);
    setBrand({});
    setThemeId(undefined);
    setError(null);
    toast("Brand kit cleared.");
  };

  return (
    <div className="space-y-5">
      <section aria-label="Default theme" className="ps-glass">
        <h3 className="ps-label mb-1">Default theme</h3>
        <p className="ps-caption mb-4">{themeId ? `New decks start with ${getTheme(themeId).name}.` : "No default chosen: new decks use the standard theme."}</p>
        <ThemeRadioGrid value={shownTheme} onChange={setThemeId} />
        {themeId ? (
          <button type="button" className="ps-link mt-3 text-[12px]" onClick={() => setThemeId(undefined)}>
            Clear default theme
          </button>
        ) : null}
      </section>

      <section aria-label="Brand details" className="ps-glass grid gap-5 sm:grid-cols-2">
        <BrandFields brand={brand} themeAccent={getTheme(shownTheme).colors.accent} onPatch={patch} idPrefix="kit" />
      </section>

      {error ? (
        <p className="ps-body text-[var(--ps-danger)]" role="alert">
          {error}
        </p>
      ) : null}

      <footer className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <Button variant="outline" className={cn(SECONDARY_BTN, "h-9 px-4")} onClick={clear} disabled={!saved && draftEmpty}>
          <Trash data-icon="inline-start" /> Clear kit
        </Button>
        <div className="flex items-center gap-3">
          <span className="ps-caption" aria-live="polite">
            {dirty ? "Unsaved changes" : saved ? "Saved" : ""}
          </span>
          <Button className={cn(PRIMARY_BTN, "h-9 px-4")} onClick={save} disabled={!dirty || draftEmpty}>
            <FloppyDisk data-icon="inline-start" weight="fill" /> Save brand kit
          </Button>
        </div>
      </footer>
    </div>
  );
}
