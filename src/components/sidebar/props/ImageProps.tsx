"use client";

import { useState } from "react";
import { Image as ImageIcon, LinkSimple, Sparkle, Trash, UploadSimple } from "@phosphor-icons/react";
import { getScope } from "@/lib/assistant/scope";
import type { ImageElement } from "@/lib/deck/schema";
import { fileToImageDataUrl, ImageIntakeError, pickImageFile } from "@/lib/image";
import { useDeckStore, type ElementPatch } from "@/store/deck-store";
import { NumInput } from "@/components/ui-kit/NumInput";
import { PercentSlider } from "@/components/ui-kit/PercentSlider";
import { PropertyGroup } from "@/components/ui-kit/PropertyGroup";
import { PropertyRow } from "@/components/ui-kit/PropertyRow";
import { Segmented } from "@/components/ui-kit/Segmented";
import { TextInput } from "@/components/ui-kit/TextInput";
import { opts } from "@/components/ui-kit/options";
import { useSidebarStore } from "../sidebar-store";
import { runAssistant, useAssistantRun } from "../useAssistant";

const POSITIONS = ["0% 0%", "50% 0%", "100% 0%", "0% 50%", "50% 50%", "100% 50%", "0% 100%", "50% 100%", "100% 100%"] as const;

type Props = { el: ImageElement; patch: (p: ElementPatch) => void };

/** Image preview, upload or URL, fit, focal point, radius, overlay, image idea and alt text. */
export function ImageProps({ el, patch }: Props) {
  const sending = useAssistantRun((s) => s.sending);
  const setTab = useSidebarStore((s) => s.setTab);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pasting, setPasting] = useState(false);

  const upload = async () => {
    setError(null);
    const file = await pickImageFile();
    if (!file) return;
    setBusy(true);
    try {
      const src = await fileToImageDataUrl(file);
      patch({ src, alt: el.alt || file.name.replace(/\.[a-z0-9]+$/i, "") });
    } catch (err) {
      setError(err instanceof ImageIntakeError ? err.message : "Could not read that image.");
    } finally {
      setBusy(false);
    }
  };

  const regenerate = () => {
    const scope = getScope(useDeckStore.getState());
    if (scope.kind !== "element" || scope.element?.id !== el.id) return;
    setTab("assistant");
    void runAssistant("Suggest a new image idea for this image.", scope);
  };

  return (
    <PropertyGroup title="Image">
      <div className="ps-preview" aria-label="Image preview">
        {el.src ? (
          // eslint-disable-next-line @next/next/no-img-element -- user-supplied source
          <img src={el.src} alt={el.alt || "Preview"} style={{ objectFit: el.fit, objectPosition: el.position }} />
        ) : (
          <span className="flex flex-col items-center gap-1 px-4 text-center">
            <ImageIcon size={20} />
            {el.query ? `Idea: ${el.query}` : "No image yet"}
          </span>
        )}
      </div>
      <div className="flex gap-1.5">
        <button type="button" className="ps-btn flex-1" onClick={() => void upload()} disabled={busy}>
          <UploadSimple size={12} /> {busy ? "Reading…" : "Upload"}
        </button>
        <button type="button" className="ps-btn flex-1" aria-pressed={pasting} onClick={() => setPasting((v) => !v)}>
          <LinkSimple size={12} /> Paste URL
        </button>
      </div>
      {pasting ? (
        <TextInput
          aria-label="Image URL"
          value={el.src?.startsWith("data:") ? "" : (el.src ?? "")}
          placeholder="https://…"
          onCommit={(src) => {
            patch({ src: src.trim() || undefined });
            setPasting(false);
          }}
        />
      ) : null}
      {error ? (
        <p className="ps-caption text-[var(--ps-danger)]" role="alert">
          {error}
        </p>
      ) : (
        <p className="ps-caption">PNG, JPG, WebP or SVG up to 4 MB; large images are scaled to 1920 px.</p>
      )}
      <PropertyRow label="Fit">
        <Segmented aria-label="Fit" value={el.fit} options={opts(["cover", "contain"] as const)} onChange={(fit) => patch({ fit })} />
      </PropertyRow>
      <PropertyRow label="Position">
        <div className="ps-grid9" role="group" aria-label="Focal point">
          {POSITIONS.map((p) => (
            <button key={p} type="button" aria-pressed={el.position === p} aria-label={`Position ${p}`} title={p} onClick={() => patch({ position: p })} />
          ))}
        </div>
        <span className="ps-caption">{el.position}</span>
      </PropertyRow>
      <PropertyRow label="Radius">
        <NumInput aria-label="Corner radius" value={el.radius} min={0} onCommit={(radius) => patch({ radius: Math.max(0, radius) })} />
      </PropertyRow>
      <PropertyRow label="Overlay">
        <PercentSlider aria-label="Dark overlay" value={el.overlay} onCommit={(overlay) => patch({ overlay })} />
      </PropertyRow>
      <PropertyRow label="Image idea" stacked>
        <TextInput aria-label="Image idea" value={el.query ?? ""} placeholder="Describe the picture you want" maxLength={140} onCommit={(query) => patch({ query: query || undefined })} />
      </PropertyRow>
      <PropertyRow label="Alt text" stacked>
        <TextInput aria-label="Alt text" value={el.alt} placeholder="Describe the image for screen readers" onCommit={(alt) => patch({ alt })} />
      </PropertyRow>
      <div className="flex gap-1.5">
        <button type="button" className="ps-btn flex-1" onClick={regenerate} disabled={sending} title="Ask the assistant for a new image idea">
          <Sparkle size={12} /> Regenerate idea
        </button>
        <button type="button" className="ps-btn flex-1" data-danger="true" onClick={() => patch({ src: undefined })} disabled={!el.src} title="Clear the picture but keep the idea">
          <Trash size={12} /> Remove image
        </button>
      </div>
    </PropertyGroup>
  );
}
