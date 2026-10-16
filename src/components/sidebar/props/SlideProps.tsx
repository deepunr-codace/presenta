"use client";

import { useMemo, useState } from "react";
import { UploadSimple } from "@phosphor-icons/react";
import type { Slide, SlideBackground, Theme } from "@/lib/deck/schema";
import { fileToImageDataUrl, ImageIntakeError, pickImageFile } from "@/lib/image";
import { useDeckStore } from "@/store/deck-store";
import { LayoutPicker } from "@/components/editor/LayoutPicker";
import { PercentSlider } from "@/components/ui-kit/PercentSlider";
import { PropertyGroup } from "@/components/ui-kit/PropertyGroup";
import { PropertyRow } from "@/components/ui-kit/PropertyRow";
import { Segmented } from "@/components/ui-kit/Segmented";
import { TextAreaInput } from "@/components/ui-kit/TextAreaInput";
import { TextInput } from "@/components/ui-kit/TextInput";
import { ColorField } from "../ColorField";
import { gradientPresets } from "./gradient-presets";

type BgChoice = "default" | "alt" | "solid" | "gradient" | "image";

const BG_OPTIONS: { value: BgChoice; label: string }[] = [
  { value: "default", label: "Theme" },
  { value: "alt", label: "Alt" },
  { value: "solid", label: "Solid" },
  { value: "gradient", label: "Gradient" },
  { value: "image", label: "Image" },
];

function bgChoice(bg: SlideBackground): BgChoice {
  if (bg.kind === "theme") return bg.variant === "alt" ? "alt" : "default";
  return bg.kind;
}

type Props = { slide: Slide; theme: Theme };

/** Slide-level controls: layout, background (theme, solid, gradient or image) and speaker notes. */
export function SlideProps({ slide, theme }: Props) {
  const commit = useDeckStore((s) => s.commit);
  const presets = useMemo(() => gradientPresets(theme), [theme]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const setBackground = (background: SlideBackground) =>
    commit((d) => {
      const s = d.slides.find((x) => x.id === slide.id);
      if (s) s.background = background;
    }, "Change background");

  const bg = slide.background;
  const choose = (choice: BgChoice) => {
    switch (choice) {
      case "default":
        return setBackground({ kind: "theme", variant: "default" });
      case "alt":
        return setBackground({ kind: "theme", variant: "alt" });
      case "solid":
        return setBackground({ kind: "solid", color: bg.kind === "solid" ? bg.color : theme.colors.bg });
      case "gradient":
        return setBackground({ kind: "gradient", css: bg.kind === "gradient" ? bg.css : presets[0].css });
      case "image":
        return setBackground({ kind: "image", src: bg.kind === "image" ? bg.src : "", overlay: bg.kind === "image" ? bg.overlay : 0.4 });
    }
  };

  const uploadBackground = async () => {
    setError(null);
    const file = await pickImageFile();
    if (!file) return;
    setBusy(true);
    try {
      const src = await fileToImageDataUrl(file);
      setBackground({ kind: "image", src, overlay: bg.kind === "image" ? bg.overlay : 0.4 });
    } catch (err) {
      setError(err instanceof ImageIntakeError ? err.message : "Could not read that image.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PropertyGroup title="Layout">
        <LayoutPicker slide={slide} />
      </PropertyGroup>
      <PropertyGroup title="Background">
        <Segmented aria-label="Background" value={bgChoice(bg)} onChange={choose} options={BG_OPTIONS} />
        {bg.kind === "solid" ? (
          <PropertyRow label="Colour">
            <ColorField label="Background colour" value={bg.color} theme={theme} hexOnly onChange={(color) => color && setBackground({ kind: "solid", color })} />
            <span className="ps-caption">{bg.color}</span>
          </PropertyRow>
        ) : null}
        {bg.kind === "gradient" ? (
          <>
            <div className="ps-gradient-row" role="group" aria-label="Gradient presets">
              {presets.map((p) => (
                <button key={p.label} type="button" title={p.label} aria-label={p.label} aria-pressed={bg.css === p.css} style={{ background: p.css }} onClick={() => setBackground({ kind: "gradient", css: p.css })} />
              ))}
            </div>
            <PropertyRow label="CSS" stacked>
              <TextInput aria-label="Gradient CSS" value={bg.css} placeholder="linear-gradient(…)" onCommit={(css) => setBackground({ kind: "gradient", css })} />
            </PropertyRow>
          </>
        ) : null}
        {bg.kind === "image" ? (
          <>
            <div className="ps-preview">
              {bg.src ? (
                // eslint-disable-next-line @next/next/no-img-element -- user-supplied source
                <img src={bg.src} alt="Background preview" style={{ objectFit: "cover" }} />
              ) : (
                <span>No image yet</span>
              )}
            </div>
            <button type="button" className="ps-btn ps-btn-block" onClick={() => void uploadBackground()} disabled={busy}>
              <UploadSimple size={12} /> {busy ? "Reading…" : "Upload image"}
            </button>
            {error ? (
              <p className="ps-caption text-[var(--ps-danger)]" role="alert">
                {error}
              </p>
            ) : null}
            <PropertyRow label="URL" stacked>
              <TextInput aria-label="Background image URL" value={bg.src.startsWith("data:") ? "" : bg.src} placeholder="https://…" onCommit={(src) => setBackground({ ...bg, src })} />
            </PropertyRow>
            <PropertyRow label="Overlay">
              <PercentSlider aria-label="Overlay" value={bg.overlay} onCommit={(overlay) => setBackground({ ...bg, overlay })} />
            </PropertyRow>
          </>
        ) : null}
      </PropertyGroup>
      <PropertyGroup title="Notes">
        <TextAreaInput
          aria-label="Speaker notes"
          value={slide.notes}
          rows={4}
          placeholder="Notes for the presenter"
          onCommit={(notes) =>
            commit((d) => {
              const s = d.slides.find((x) => x.id === slide.id);
              if (s) s.notes = notes;
            }, "Edit notes")
          }
        />
      </PropertyGroup>
    </>
  );
}
