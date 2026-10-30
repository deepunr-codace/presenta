"use client";

import Link from "next/link";
import { CheckCircle, ShieldCheck, Sparkle } from "@phosphor-icons/react";
import type { Brand, Deck } from "@/lib/deck/schema";
import { applyBrand, getTheme, resolveTheme } from "@/lib/deck/themes";
import { useBrandKit } from "@/hooks/useBrandKit";
import { useDeckStore } from "@/store/deck-store";
import { PropertyGroup } from "@/components/ui-kit/PropertyGroup";

type Check = { key: string; message: string };

function brandChecks(deck: Deck, brand: Brand, themeId?: Deck["themeId"]): Check[] {
  const checks: Check[] = [];
  if (themeId && deck.themeId !== themeId) checks.push({ key: "theme", message: `Theme is ${getTheme(deck.themeId).name}; your kit uses ${getTheme(themeId).name}.` });
  const current = deck.meta.brand;
  const actualTheme = resolveTheme(deck);
  const expectedTheme = applyBrand(getTheme(themeId ?? deck.themeId), brand);
  if (brand.company && current?.company !== brand.company) checks.push({ key: "company", message: `Company name should be ${brand.company}.` });
  if (brand.logoDataUrl && current?.logoDataUrl !== brand.logoDataUrl) checks.push({ key: "logo", message: "Deck logo differs from the saved brand logo." });
  if (brand.accent && actualTheme.colors.accent.toLowerCase() !== expectedTheme.colors.accent.toLowerCase()) checks.push({ key: "accent", message: `Brand accent should be ${brand.accent}.` });
  if (brand.fontPair && (actualTheme.fonts.display !== expectedTheme.fonts.display || actualTheme.fonts.body !== expectedTheme.fonts.body)) checks.push({ key: "font", message: `Fonts should use the ${brand.fontPair} pair.` });
  if (brand.notes && current?.notes !== brand.notes) checks.push({ key: "voice", message: "Brand voice notes are missing or differ from the saved kit." });
  return checks;
}

/** Compare deck-level brand settings with the saved kit and offer a reversible one-click correction. */
export function BrandGuardian({ deck }: { deck: Deck }) {
  const kit = useBrandKit();
  const commit = useDeckStore((state) => state.commit);
  if (!kit) {
    return (
      <PropertyGroup title="Brand check">
        <p className="ps-caption">Save a brand kit to check this deck against your company colors, fonts and identity.</p>
        <Link className="ps-btn self-start" href="/brand">Set up brand kit</Link>
      </PropertyGroup>
    );
  }

  const checks = brandChecks(deck, kit.brand, kit.themeId);
  const applyKit = () => commit((draft) => {
    draft.meta.brand = { ...(draft.meta.brand ?? {}), ...kit.brand };
    if (kit.themeId) draft.themeId = kit.themeId;
  }, "Apply brand kit");

  return (
    <PropertyGroup title="Brand check">
      {checks.length === 0 ? (
        <p className="flex items-center gap-1.5 text-[12px] text-[var(--ps-success)]" role="status"><CheckCircle size={15} weight="fill" /> Deck settings match the saved brand kit.</p>
      ) : (
        <>
          <p className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--ps-ink)]"><ShieldCheck size={15} /> {checks.length} brand setting{checks.length === 1 ? "" : "s"} to review</p>
          <ul className="list-disc space-y-1 pl-5 text-[12px] leading-5 text-[var(--ps-smoke)]">
            {checks.map((check) => <li key={check.key}>{check.message}</li>)}
          </ul>
          <button type="button" className="ps-btn self-start" onClick={applyKit}><Sparkle size={12} /> Apply saved kit to this deck</button>
          <p className="ps-caption">This updates the deck’s theme and saved brand fields. You can undo it.</p>
        </>
      )}
    </PropertyGroup>
  );
}
