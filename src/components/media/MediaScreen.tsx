"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { DownloadSimple, Images, Trash, UploadSimple } from "@phosphor-icons/react";
import { addMediaFile, deleteMedia, formatBytes, getMediaData, listMedia, totalBytes, type MediaItem } from "@/lib/media";
import { downloadBlob } from "@/lib/persist";
import { timeAgo } from "@/lib/time";
import { AppShell } from "@/components/shell/AppShell";
import { useToast } from "@/components/shell/Toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorNotice } from "@/components/ui-kit/ErrorNotice";

/** File extension for a data URL's type. */
function extFor(mime: string): string {
  return mime === "image/jpeg" ? "jpg" : mime === "image/svg+xml" ? "svg" : (mime.split("/")[1] ?? "png");
}

/** Turn a data URL into a Blob so it can be downloaded. */
async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

/** Media library at /media: upload images once, then reuse them in any deck from the editor's image panel. */
export function MediaScreen() {
  const { toast } = useToast();
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [confirm, setConfirm] = useState<MediaItem | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      setItems(await listMedia());
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "Could not read the media library."]);
      setItems([]);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    listMedia()
      .then((list) => alive && setItems(list))
      .catch((err: unknown) => {
        if (!alive) return;
        setErrors([err instanceof Error ? err.message : "Could not read the media library."]);
        setItems([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const upload = async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/"));
    const skipped = files.length - images.length;
    const problems: string[] = skipped ? [`${skipped} file${skipped === 1 ? " was" : "s were"} skipped because ${skipped === 1 ? "it is" : "they are"} not an image.`] : [];
    if (!images.length) {
      setErrors(problems);
      return;
    }
    setBusy(true);
    let added = 0;
    for (const file of images) {
      try {
        await addMediaFile(file);
        added += 1;
      } catch (err) {
        problems.push(`${file.name}: ${err instanceof Error ? err.message : "could not be added."}`);
      }
    }
    setBusy(false);
    setErrors(problems);
    await refresh();
    if (added) toast(added === 1 ? "Image added to the library." : `${added} images added to the library.`, { tone: "success" });
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void upload(Array.from(e.dataTransfer.files));
  };

  const download = async (m: MediaItem) => {
    const data = await getMediaData(m.id);
    if (!data) {
      setErrors([`“${m.name}” could not be read.`]);
      return;
    }
    downloadBlob(await dataUrlToBlob(data), `${m.name}.${extFor(m.mime)}`);
  };

  const remove = async () => {
    const target = confirm;
    setConfirm(null);
    if (!target) return;
    try {
      await deleteMedia(target.id);
      await refresh();
      toast("Image deleted.");
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "Could not delete that image."]);
    }
  };

  const count = items?.length ?? 0;

  return (
    <AppShell
      active="media"
      sidebar="full"
      breadcrumbs={[{ label: "Studio", href: "/" }, { label: "Media library" }]}
      actions={
        <Button size="sm" className="ps-btn ps-btn-primary ps-btn-xs" onClick={() => fileRef.current?.click()} disabled={busy}>
          <UploadSimple data-icon="inline-start" /> {busy ? "Adding…" : "Upload"}
        </Button>
      }
    >
      <div className="ps-page" onDragOver={(e) => (e.preventDefault(), setDragging(true))} onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)} onDrop={onDrop}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          aria-hidden
          tabIndex={-1}
          onChange={(e) => {
            void upload(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <header className="mb-8">
          <h1 className="ps-heading">Media library</h1>
          <p className="ps-body-lg mt-2">
            Your images, ready to reuse in any deck. Pick from here in the editor&apos;s image panel.
            {items && count > 0 ? ` ${count} image${count === 1 ? "" : "s"} · ${formatBytes(totalBytes(items))}.` : ""}
          </p>
        </header>

        {errors.length ? (
          <ErrorNotice
            compact
            className="mb-4"
            message={
              <>
                {errors.map((e) => (
                  <span key={e} className="block">
                    {e}
                  </span>
                ))}
              </>
            }
          />
        ) : null}

        {items === null ? (
          <div className="ps-media-grid" aria-hidden>
            <div className="ps-glass h-48 animate-pulse" />
            <div className="ps-glass h-48 animate-pulse" />
            <div className="ps-glass h-48 animate-pulse" />
            <div className="ps-glass h-48 animate-pulse" />
          </div>
        ) : count === 0 ? (
          <button type="button" className="ps-media-drop" data-dragging={dragging ? "true" : undefined} onClick={() => fileRef.current?.click()}>
            <span className="ps-media-drop-icon" aria-hidden>
              <Images size={28} />
            </span>
            <span className="ps-title">Drop images here</span>
            <span className="ps-body">or click to choose files. PNG, JPG, WebP, GIF or SVG up to 8 MB each; large images are scaled to 1920 px.</span>
          </button>
        ) : (
          <>
            <ul className="ps-media-grid" aria-label="Images" data-dragging={dragging ? "true" : undefined}>
              {items.map((m) => (
                <li key={m.id} className="ps-media-tile">
                  <div className="ps-media-thumb">
                    {/* eslint-disable-next-line @next/next/no-img-element -- local data URL thumbnail */}
                    <img src={m.thumb} alt={m.name} loading="lazy" />
                    <div className="ps-media-actions">
                      <button type="button" className="ps-iconbtn" aria-label={`Download ${m.name}`} title="Download" onClick={() => void download(m)}>
                        <DownloadSimple size={16} />
                      </button>
                      <button type="button" className="ps-iconbtn" data-danger="true" aria-label={`Delete ${m.name}`} title="Delete" onClick={() => setConfirm(m)}>
                        <Trash size={16} />
                      </button>
                    </div>
                  </div>
                  <p className="ps-media-name" title={m.name}>
                    {m.name}
                  </p>
                  <p className="ps-cardcaption">
                    {m.width}×{m.height} · {formatBytes(m.bytes)} · {timeAgo(m.addedAt)}
                  </p>
                </li>
              ))}
            </ul>
            <p className="ps-caption mt-4">Drag images anywhere on this page to add them.</p>
          </>
        )}
      </div>

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this image?</DialogTitle>
            <DialogDescription>“{confirm?.name}” will be removed from the library. Slides that already use it keep their copy.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void remove()}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
