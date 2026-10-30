"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Images, UploadSimple } from "@phosphor-icons/react";
import { addMediaFile, formatBytes, listMedia, type MediaItem } from "@/lib/media";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind?: "image" | "video";
  /** Called with the chosen image's public URL and its name. */
  onPick: (url: string, name: string) => void;
};

/** Choose an image from the media library, or add a new one to it, without leaving the editor. */
export function MediaPicker({ open, onOpenChange, onPick, kind = "image" }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="ps-media-picker">
        <DialogHeader>
          <DialogTitle>Media library</DialogTitle>
          <DialogDescription>Choose a {kind} from your media library.</DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so it always shows the current library. */}
        <PickerBody
          kind={kind}
          onPick={(url, name) => {
            onPick(url, name);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function PickerBody({ onPick, kind }: { onPick: (url: string, name: string) => void; kind: "image" | "video" }) {
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    listMedia()
      .then((list) => alive && setItems(list))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, []);

  const media = items?.filter((m) => m.kind === kind) ?? null;

  const addFiles = async (files: File[]) => {
    setBusy(true);
    setError(null);
    for (const file of files.filter((f) => kind === "image" ? f.type.startsWith("image/") : ["video/mp4", "video/webm"].includes(f.type))) {
      try {
        await addMediaFile(file);
      } catch (err) {
        setError(`${file.name}: ${err instanceof Error ? err.message : "could not be added."}`);
      }
    }
    setItems(await listMedia());
    setBusy(false);
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <button type="button" className="ps-btn ps-btn-xs" onClick={() => fileRef.current?.click()} disabled={busy}>
          <UploadSimple size={14} /> {busy ? "Adding…" : "Upload to library"}
        </button>
        <Link href="/media" className="ps-link text-[12px]">
          Open the library
        </Link>
        <input
          ref={fileRef}
          type="file"
          accept={kind === "image" ? "image/*" : "video/mp4,video/webm"}
          multiple
          className="hidden"
          aria-hidden
          tabIndex={-1}
          onChange={(e) => {
            void addFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>
      {error ? (
        <p className="ps-caption mb-2 text-[var(--ps-danger)]" role="alert">
          {error}
        </p>
      ) : null}
      {media === null ? (
        <p className="ps-body py-8 text-center">Loading…</p>
      ) : media.length === 0 ? (
        <div className="ps-media-picker-empty">
          <Images size={24} aria-hidden />
          <p className="ps-body">No {kind === "video" ? "videos" : "images"} yet. Upload one to get started.</p>
        </div>
      ) : (
        <ul className="ps-media-picker-grid" aria-label={`Library ${kind}s`}>
          {media.map((m) => (
            <li key={m.id}>
              <button type="button" className="ps-media-pick" onClick={() => onPick(m.url, m.name)} title={`${m.name} · ${formatBytes(m.bytes)}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- remote thumbnail */}
                <img src={m.thumb} alt={m.name} loading="lazy" />
                <span>{m.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
