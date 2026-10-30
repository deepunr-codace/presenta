"use client";

import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, Images, LinkSimple, Sparkle, Trash, UploadSimple } from "@phosphor-icons/react";
import { getScope } from "@/lib/assistant/scope";
import type { ImageElement } from "@/lib/deck/schema";
import { fileToImageDataUrl, ImageIntakeError, pickImageFile } from "@/lib/image";
import { resolveTheme } from "@/lib/deck/themes";
import { postGenerateImage } from "@/lib/api-client";
import { useDeckStore, type ElementPatch } from "@/store/deck-store";
import { MediaPicker } from "@/components/media/MediaPicker";
import { NumInput } from "@/components/ui-kit/NumInput";
import { PercentSlider } from "@/components/ui-kit/PercentSlider";
import { PropertyGroup } from "@/components/ui-kit/PropertyGroup";
import { PropertyRow } from "@/components/ui-kit/PropertyRow";
import { Segmented } from "@/components/ui-kit/Segmented";
import { TextInput } from "@/components/ui-kit/TextInput";
import { opts } from "@/components/ui-kit/options";
import { useSidebarStore } from "../sidebar-store";
import { runAssistant, useAssistantRun } from "../useAssistant";
import { useApiKeyDialog } from "@/components/shell/api-key-dialog-store";

const POSITIONS = ["0% 0%", "50% 0%", "100% 0%", "0% 50%", "50% 50%", "100% 50%", "0% 100%", "50% 100%", "100% 100%"] as const;

type Props = { el: ImageElement; patch: (p: ElementPatch) => void };

/** Image preview, upload or URL, fit, focal point, radius, overlay, image idea and alt text. */
export function ImageProps({ el, patch }: Props) {
  const sending = useAssistantRun((s) => s.sending);
  const setTab = useSidebarStore((s) => s.setTab);
  const openKeyDialog = useApiKeyDialog((s) => s.setOpen);
  const [error, setError] = useState<string | null>(null);
  const [needsOpenAi, setNeedsOpenAi] = useState(false);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [library, setLibrary] = useState(false);
  const imageRequest = useRef<AbortController | null>(null);

  useEffect(() => () => imageRequest.current?.abort(), []);

  const upload = async () => {
    setError(null);
    setNeedsOpenAi(false);
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

  const generateImage = async () => {
    const query = el.query?.trim();
    if (!query || generating) return;
    setError(null);
    setNeedsOpenAi(false);
    setGenerating(true);
    const controller = new AbortController();
    imageRequest.current = controller;
    try {
      const deck = useDeckStore.getState().deck;
      const theme = deck ? resolveTheme(deck) : null;
      const ratio = el.w / Math.max(1, el.h);
      const size = ratio > 1.25 ? "1536x864" : ratio < 0.8 ? "864x1536" : "1024x1024";
      const prompt = `Subject: ${query}. Art direction: a polished editorial visual for a ${theme?.name ?? "modern"} presentation, using ${theme?.colors.accent ?? "a restrained blue"} with balanced neutrals. Compose for a ${size === "1536x864" ? "wide landscape" : size === "864x1536" ? "portrait" : "square"} frame, with one clear focal point and useful negative space. No lettering, logos or watermarks.`;
      const result = await postGenerateImage({ prompt, size }, controller.signal);
      if (!result.ok) {
        setNeedsOpenAi(result.code === "auth");
        throw new Error(result.error);
      }
      patch({ src: result.data.src, alt: el.alt || query });
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Could not generate this image.");
    } finally {
      if (imageRequest.current === controller) imageRequest.current = null;
      setGenerating(false);
    }
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
        <button type="button" className="ps-btn flex-1" onClick={() => setLibrary(true)}>
          <Images size={12} /> Library
        </button>
        <button type="button" className="ps-btn flex-1" aria-pressed={pasting} onClick={() => setPasting((v) => !v)}>
          <LinkSimple size={12} /> URL
        </button>
      </div>
      <button type="button" className="ps-btn self-start" onClick={() => void generateImage()} disabled={!el.query?.trim() || generating} title="Generate a slide-ready image with OpenAI">
        <Sparkle size={12} /> {generating ? "Generating image…" : "Generate image"}
      </button>
      <p className="ps-caption">Requires an OpenAI API key. If you use your own key, OpenAI may charge your account.</p>
      <MediaPicker open={library} onOpenChange={setLibrary} onPick={(src, name) => patch({ src, alt: el.alt || name })} />
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
        <div>
          <p className="ps-caption text-[var(--ps-danger)]" role="alert">{error}</p>
          {needsOpenAi ? <button type="button" className="ps-link mt-1 text-[12px]" onClick={() => openKeyDialog(true)}>Add or change API key</button> : null}
        </div>
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
