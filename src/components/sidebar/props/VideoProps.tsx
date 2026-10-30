"use client";

import { useRef, useState } from "react";
import { Images, UploadSimple } from "@phosphor-icons/react";
import { isSafeVideoUrl, type VideoElement } from "@/lib/deck/schema";
import { addMediaFile } from "@/lib/media";
import type { ElementPatch } from "@/store/deck-store";
import { MediaPicker } from "@/components/media/MediaPicker";
import { PropertyGroup } from "@/components/ui-kit/PropertyGroup";
import { PropertyRow } from "@/components/ui-kit/PropertyRow";
import { TextInput } from "@/components/ui-kit/TextInput";

export function VideoProps({ element, patch }: { element: VideoElement; patch: (patch: ElementPatch) => void }) {
  const [error, setError] = useState("");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = async (file?: File) => {
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      const item = await addMediaFile(file);
      patch({ src: item.url, title: element.title || item.name });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload this video.");
    } finally {
      setBusy(false);
    }
  };
  return <PropertyGroup title="Video">
    <div className="flex gap-1.5">
      <button type="button" className="ps-btn flex-1" onClick={() => fileRef.current?.click()} disabled={busy}>
        <UploadSimple size={12} /> {busy ? "Uploading…" : "Upload video"}
      </button>
      <button type="button" className="ps-btn flex-1" onClick={() => setLibraryOpen(true)}>
        <Images size={12} /> Choose from library
      </button>
      <input ref={fileRef} type="file" accept="video/mp4,video/webm" className="hidden" aria-hidden tabIndex={-1} onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ""; }} />
    </div>
    <PropertyRow label="Source URL" stacked>
      <TextInput aria-label="Video source URL" value={element.src} placeholder="YouTube, Vimeo or direct video URL" onCommit={(src) => {
        const value = src.trim();
        if (!value) { setError("Add a video URL to use this element."); return; }
        if (!isSafeVideoUrl(value)) { setError("Use a YouTube or Vimeo link, or a direct MP4, WebM or Ogg video URL."); return; }
        patch({ src: value });
        setError("");
      }} />
    </PropertyRow>
    <PropertyRow label="Title" stacked>
      <TextInput aria-label="Video title" value={element.title} maxLength={120} onCommit={(title) => patch({ title })} />
    </PropertyRow>
    {error ? <p className="ps-caption text-[var(--ps-danger)]" role="alert">{error}</p> : null}
    <p className="ps-caption">Supports YouTube, Vimeo and direct MP4, WebM or Ogg links. Select the element to edit; playback works in presentation and shared view.</p>
    <MediaPicker open={libraryOpen} onOpenChange={setLibraryOpen} kind="video" onPick={(src, name) => patch({ src, title: element.title || name })} />
  </PropertyGroup>;
}
