"use client";

import { useMemo } from "react";
import { buildSlide } from "@/lib/deck/layouts";
import { STAGE_W, type ImageElement, type Slide, type SlideContent } from "@/lib/deck/schema";
import { applyBrand, getTheme } from "@/lib/deck/themes";
import { FitSlide } from "@/components/canvas/FitSlide";
import { FONT_PAIRS } from "./brand-options";
import { useWizardStore } from "./wizard-state";

const LOGO_BOX = { w: 220, h: 90 } as const;

function coverContent(title: string, subtitle: string | undefined, company: string | undefined): SlideContent {
  return {
    kind: "cover",
    title: title.slice(0, 90),
    subtitle: subtitle?.slice(0, 160),
    body: company ? `Prepared by ${company}` : undefined,
  };
}

/** The first outline slide rendered as a cover with the current theme and brand applied. */
export function BrandPreview() {
  const outline = useWizardStore((s) => s.outline);
  const themeId = useWizardStore((s) => s.themeId);
  const brand = useWizardStore((s) => s.brand);

  const theme = useMemo(() => applyBrand(getTheme(themeId), brand), [themeId, brand]);
  const slide = useMemo<Slide>(() => {
    const first = outline?.slides[0];
    const content = coverContent(first?.title ?? outline?.title ?? "Your deck title", first?.goal ?? outline?.audience, brand.company);
    const built = buildSlide(content, theme, "cover");
    if (brand.logoDataUrl) {
      const logo: ImageElement = {
        id: "preview-logo",
        type: "image",
        src: brand.logoDataUrl,
        alt: "Logo",
        fit: "contain",
        radius: 0,
        position: "100% 50%",
        overlay: 0,
        x: STAGE_W - 96 - LOGO_BOX.w,
        y: 96,
        w: LOGO_BOX.w,
        h: LOGO_BOX.h,
        rotation: 0,
        z: 999,
        locked: true,
        opacity: 1,
      };
      built.elements = [...built.elements, logo];
    }
    return built;
  }, [outline, theme, brand.company, brand.logoDataUrl]);

  return (
    <>
      <FitSlide slide={slide} theme={theme} className="ps-tile p-0" />
      <p className="ps-caption mt-2">
        Cover slide with <span className="font-medium text-[var(--ps-graphite)]">{theme.name}</span>
        {brand.accent ? " and your accent" : ""}
        {brand.fontPair ? ` in ${FONT_PAIRS.find((f) => f.id === brand.fontPair)?.label ?? ""}` : ""}.
      </p>
    </>
  );
}
