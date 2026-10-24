"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Images, UploadSimple } from "@phosphor-icons/react";
import { addMediaFile, formatBytes, getMediaData, listMedia, type MediaItem } from "@/lib/media";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the chosen image as a data URL and its name. */
  onPick: (dataUrl: string, name: string) => void;
};

/** Choose an image from the media library, or add a new one to it, without leaving the editor. */
export function MediaPicker({ open, onOpenChange, onPick }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="ps-media-picker">
        <DialogHeader>
          <DialogTitle>Media library</DialogTitle>
          <DialogDescription>Choose an image for this slide.</DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so it always shows the current library. */}
        <PickerBody
          onPick={(url, name) => {
            onPick(url, name);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function PickerBody({ onPick }: { onPick: (dataUrl: string, name: string) => void }) {
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

  const choose = async (m: MediaItem) => {
    const data = await getMediaData(m.id);
    if (!data) {
      setError(`“${m.name}” could not be read.`);
      return;
    }
    onPick(data, m.name);
  };

  const addFiles = async (files: File[]) => {
    setBusy(true);
    setError(null);
    for (const file of files.filter((f) => f.type.startsWith("image/"))) {
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
          accept="image/*"
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
      {items === null ? (
        <p className="ps-body py-8 text-center">Loading…</p>
      ) : items.length === 0 ? (
        <div className="ps-media-picker-empty">
          <Images size={24} aria-hidden />
          <p className="ps-body">No images yet. Upload one to get started.</p>
        </div>
      ) : (
        <ul className="ps-media-picker-grid" aria-label="Library images">
          {items.map((m) => (
            <li key={m.id}>
              <button type="button" className="ps-media-pick" onClick={() => void choose(m)} title={`${m.name} · ${formatBytes(m.bytes)}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- local data URL thumbnail */}
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
