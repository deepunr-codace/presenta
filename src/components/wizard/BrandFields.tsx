"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Check, Trash, UploadSimple } from "@phosphor-icons/react";
import { FontPairSchema, type Brand, type FontPair } from "@/lib/deck/schema";
import { FIELD, GHOST_BTN, SECONDARY_BTN } from "@/lib/styles";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ACCENT_PRESETS, FONT_ITEMS, FONT_PAIRS, LOGO_MAX_BYTES } from "./brand-options";

function isFontPair(v: unknown): v is FontPair {
  return FontPairSchema.safeParse(v).success;
}

type Props = {
  brand: Brand;
  /** Accent shown when none is chosen (the theme's own). */
  themeAccent: string;
  onPatch: (patch: Partial<Brand>) => void;
  /** Prefix for element ids, so two forms on a page never clash. */
  idPrefix?: string;
};

/**
 * The brand fields shared by the wizard's Brand step and the Brand kit page: company, logo, accent, font pair
 * and notes for the AI. Renders its fields as direct children, so the parent supplies the grid.
 */
export function BrandFields({ brand, themeAccent, onPatch, idPrefix = "brand" }: Props) {
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
      if (typeof reader.result === "string") onPatch({ logoDataUrl: reader.result });
    };
    reader.onerror = () => setLogoError("Could not read that file.");
    reader.readAsDataURL(file);
  };

  return (
    <>
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-company`} className="ps-label text-[13px] leading-[18px]">
          Company name
        </Label>
        <Input id={`${idPrefix}-company`} value={brand.company ?? ""} maxLength={80} placeholder="e.g. CodeAce" onChange={(e) => onPatch({ company: e.target.value })} className={cn(FIELD, "h-9")} />
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
              <Button variant="ghost" size="sm" className={cn(GHOST_BTN, "h-8 px-3")} onClick={() => onPatch({ logoDataUrl: undefined })}>
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
        <Label htmlFor={`${idPrefix}-accent`} className="ps-label text-[13px] leading-[18px]">
          Accent colour
        </Label>
        <div className="grid w-full max-w-[320px] grid-cols-9 items-center justify-items-center gap-1.5" role="group" aria-label="Accent colour">
          <label className="ps-focus-within relative grid size-8 cursor-pointer place-items-center overflow-hidden rounded-full border border-[var(--ps-line-2)]" title="Custom colour">
            <input id={`${idPrefix}-accent`} type="color" value={brand.accent ?? themeAccent} onChange={(e) => onPatch({ accent: e.target.value })} className="absolute inset-0 size-full cursor-pointer opacity-0" aria-label="Custom accent colour" />
            <span className="size-full" style={{ background: brand.accent ?? themeAccent }} aria-hidden />
          </label>
          {ACCENT_PRESETS.map((hex) => {
            const on = brand.accent?.toUpperCase() === hex;
            return (
              <button key={hex} type="button" aria-label={`Accent ${hex}`} aria-pressed={on} onClick={() => onPatch({ accent: hex })} className={cn("ps-focus grid size-7 place-items-center rounded-full ring-offset-2 ring-offset-[var(--ps-surface)] transition-shadow", on && "ring-2 ring-[var(--ps-ink)]")} style={{ background: hex }}>
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
              <button type="button" onClick={() => onPatch({ accent: undefined })} className="ps-link text-[12px]">
                Use theme default
              </button>
            </>
          ) : null}
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-fonts`} className="ps-label text-[13px] leading-[18px]">
          Font pair
        </Label>
        <Select value={brand.fontPair ?? "theme"} items={FONT_ITEMS} onValueChange={(v) => onPatch({ fontPair: isFontPair(v) ? v : undefined })}>
          <SelectTrigger id={`${idPrefix}-fonts`} className={cn(FIELD, "h-9 w-full")}>
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
        <Label htmlFor={`${idPrefix}-notes`} className="ps-label text-[13px] leading-[18px]">
          Notes for the AI
        </Label>
        <Textarea id={`${idPrefix}-notes`} value={brand.notes ?? ""} maxLength={400} rows={3} placeholder="Voice, words to avoid, anything the AI should respect" onChange={(e) => onPatch({ notes: e.target.value })} className={cn(FIELD, "min-h-[72px] resize-none")} />
        <p className="ps-caption text-right tabular-nums">{(brand.notes ?? "").length} / 400</p>
      </div>
    </>
  );
}
