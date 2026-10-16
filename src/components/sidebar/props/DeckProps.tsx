"use client";

import { useState } from "react";
import { UploadSimple, X } from "@phosphor-icons/react";
import { FontPairSchema, type Brand, type Deck, type FontPair, type Theme } from "@/lib/deck/schema";
import { fileToImageDataUrl, ImageIntakeError, pickImageFile } from "@/lib/image";
import { useDeckStore } from "@/store/deck-store";
import { ThemeGrid } from "@/components/editor/ThemeGrid";
import { PropertyGroup } from "@/components/ui-kit/PropertyGroup";
import { PropertyRow } from "@/components/ui-kit/PropertyRow";
import { SelectInput } from "@/components/ui-kit/SelectInput";
import { TextInput } from "@/components/ui-kit/TextInput";
import { ColorField } from "../ColorField";

const FONT_PAIRS: { value: FontPair | "theme"; label: string }[] = [
  { value: "theme", label: "Theme default" },
  { value: "inter", label: "Inter Tight / Inter" },
  { value: "dm", label: "DM Sans" },
  { value: "oswald", label: "Oswald / Roboto" },
  { value: "roboto", label: "Roboto" },
];

const LOGO_MAX_BYTES = 1_000_000;

type Props = { deck: Deck; theme: Theme };

/** Deck-level controls: title, theme grid, brand accent, font pair, company and logo. */
export function DeckProps({ deck, theme }: Props) {
  const setTitle = useDeckStore((s) => s.setTitle);
  const commit = useDeckStore((s) => s.commit);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const brand = deck.meta.brand;

  const patchBrand = (p: Partial<Brand>) =>
    commit((d) => {
      const next: Brand = { ...(d.meta.brand ?? {}), ...p };
      for (const k of Object.keys(next) as (keyof Brand)[]) if (next[k] === undefined) delete next[k];
      d.meta.brand = Object.keys(next).length ? next : undefined;
    }, "Update brand");

  const uploadLogo = async () => {
    setError(null);
    const file = await pickImageFile();
    if (!file) return;
    setBusy(true);
    try {
      const logoDataUrl = await fileToImageDataUrl(file, { maxBytes: LOGO_MAX_BYTES, maxDim: 800 });
      patchBrand({ logoDataUrl });
    } catch (err) {
      setError(err instanceof ImageIntakeError ? err.message : "Could not read that image.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PropertyGroup title="Deck">
      <PropertyRow label="Title" stacked>
        <TextInput aria-label="Deck title" value={deck.title} onCommit={(title) => setTitle(title.trim() || deck.title)} />
      </PropertyRow>
      <PropertyRow label="Theme" stacked>
        <ThemeGrid />
      </PropertyRow>
      <PropertyRow label="Brand accent">
        <ColorField label="Brand accent" value={brand?.accent} theme={theme} hexOnly allowEmpty emptyLabel="Theme accent" onChange={(accent) => patchBrand({ accent })} />
        <span className="ps-caption">{brand?.accent ?? "Theme accent"}</span>
      </PropertyRow>
      <PropertyRow label="Fonts">
        <SelectInput aria-label="Font pair" value={brand?.fontPair ?? "theme"} options={FONT_PAIRS} onChange={(v) => patchBrand({ fontPair: FontPairSchema.safeParse(v).success ? (v as FontPair) : undefined })} />
      </PropertyRow>
      <PropertyRow label="Company">
        <TextInput aria-label="Company" value={brand?.company ?? ""} placeholder="Company name" maxLength={80} onCommit={(company) => patchBrand({ company: company.trim() || undefined })} />
      </PropertyRow>
      <PropertyRow label="Logo">
        {brand?.logoDataUrl ? (
          <>
            <span className="ps-preview ps-preview-logo">
              {/* eslint-disable-next-line @next/next/no-img-element -- uploaded data URL */}
              <img src={brand.logoDataUrl} alt={brand.company ? `${brand.company} logo` : "Logo"} />
            </span>
            <button type="button" className="ps-btn" onClick={() => void uploadLogo()} disabled={busy}>
              Replace
            </button>
            <button type="button" className="ps-iconbtn" aria-label="Remove logo" title="Remove logo" onClick={() => patchBrand({ logoDataUrl: undefined })}>
              <X size={12} />
            </button>
          </>
        ) : (
          <button type="button" className="ps-btn" onClick={() => void uploadLogo()} disabled={busy}>
            <UploadSimple size={12} /> {busy ? "Reading…" : "Upload logo"}
          </button>
        )}
      </PropertyRow>
      {error ? (
        <p className="ps-caption text-[var(--ps-danger)]" role="alert">
          {error}
        </p>
      ) : (
        <p className="ps-caption">Brand accent and fonts restyle every slide; the logo is used when slides are generated.</p>
      )}
    </PropertyGroup>
  );
}
