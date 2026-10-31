"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
} from "react";
import {
  Check,
  CheckSquare,
  DownloadSimple,
  Images,
  PencilSimple,
  Trash,
  UploadSimple,
  X,
} from "@phosphor-icons/react";
import {
  addMediaFile,
  deleteMedia,
  formatBytes,
  formatDuration,
  listMedia,
  renameMedia,
  totalBytes,
  type MediaItem,
} from "@/lib/media";
import { downloadBlob } from "@/lib/persist";
import { timeAgo } from "@/lib/time";
import { AppShell } from "@/components/shell/AppShell";
import { useToast } from "@/components/shell/Toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorNotice } from "@/components/ui-kit/ErrorNotice";

/** File extension for a file's type. */
function extFor(mime: string): string {
  return mime === "image/jpeg"
    ? "jpg"
    : mime === "image/svg+xml"
      ? "svg"
      : (mime.split("/")[1] ?? "png");
}

/** Media library at /media: upload images and videos once, then reuse images in any deck from the editor's image panel. */
export function MediaScreen() {
  const { toast } = useToast();
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  /** Items waiting for the delete confirmation: one from its tile, or every selected one. */
  const [confirm, setConfirm] = useState<MediaItem[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const selecting = selected.size > 0;
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      setItems(await listMedia());
    } catch (err) {
      setErrors([
        err instanceof Error
          ? err.message
          : "Could not read the media library.",
      ]);
      setItems([]);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    listMedia()
      .then((list) => alive && setItems(list))
      .catch((err: unknown) => {
        if (!alive) return;
        setErrors([
          err instanceof Error
            ? err.message
            : "Could not read the media library.",
        ]);
        setItems([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const upload = async (files: File[]) => {
    const accepted = files.filter(
      (f) =>
        f.type.startsWith("image/") ||
        f.type === "video/mp4" ||
        f.type === "video/webm",
    );
    const skipped = files.length - accepted.length;
    const problems: string[] = skipped
      ? [
          `${skipped} file${skipped === 1 ? " was" : "s were"} skipped because ${skipped === 1 ? "it is" : "they are"} not an image, MP4 or WebM.`,
        ]
      : [];
    if (!accepted.length) {
      setErrors(problems);
      return;
    }
    setBusy(true);
    let added = 0;
    for (const file of accepted) {
      try {
        await addMediaFile(file);
        added += 1;
      } catch (err) {
        problems.push(
          `${file.name}: ${err instanceof Error ? err.message : "could not be added."}`,
        );
      }
    }
    setBusy(false);
    setErrors(problems);
    await refresh();
    if (added)
      toast(
        added === 1
          ? "Added to the library."
          : `${added} files added to the library.`,
        { tone: "success" },
      );
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void upload(Array.from(e.dataTransfer.files));
  };

  const download = async (m: MediaItem) => {
    try {
      const res = await fetch(m.url);
      if (!res.ok) throw new Error();
      downloadBlob(await res.blob(), `${m.name}.${extFor(m.mime)}`);
    } catch {
      setErrors([`“${m.name}” could not be downloaded.`]);
    }
  };

  const remove = async () => {
    const targets = confirm ?? [];
    if (!targets.length) return;
    setDeleting(true);
    const problems: string[] = [];
    let done = 0;
    for (const m of targets) {
      try {
        await deleteMedia(m.id);
        done += 1;
      } catch (err) {
        problems.push(
          `${m.name}: ${err instanceof Error ? err.message : "could not be deleted."}`,
        );
      }
    }
    setDeleting(false);
    setConfirm(null);
    setSelected(new Set());
    setErrors(problems);
    await refresh();
    if (done) toast(done === 1 ? "Deleted." : `${done} files deleted.`);
  };

  const saveName = async () => {
    const target = renaming;
    if (!target) return;
    const name = target.name.trim();
    const current = items?.find((m) => m.id === target.id);
    setRenaming(null);
    if (!name || !current || name === current.name) return;
    setItems(
      (list) =>
        list?.map((m) => (m.id === target.id ? { ...m, name } : m)) ?? null,
    );
    try {
      await renameMedia(target.id, name);
    } catch (err) {
      setErrors([
        err instanceof Error ? err.message : "Could not rename that item.",
      ]);
      await refresh();
    }
  };

  const count = items?.length ?? 0;

  return (
    <AppShell
      active="media"
      sidebar="full"
      breadcrumbs={[{ label: "Studio", href: "/" }, { label: "Media library" }]}
      actions={
        <Button
          size="sm"
          className="ps-btn ps-btn-primary ps-btn-xs"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          <UploadSimple data-icon="inline-start" />{" "}
          {busy ? "Adding…" : "Upload"}
        </Button>
      }
    >
      <div
        className="ps-page"
        onDragOver={(e) => (e.preventDefault(), setDragging(true))}
        onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
        onDrop={onDrop}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/mp4,video/webm"
          multiple
          className="hidden"
          aria-hidden
          tabIndex={-1}
          onChange={(e) => {
            void upload(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <header className="ps-page-hero mb-8">
          <h1 className="ps-heading">Media library</h1>
          <p className="ps-body-lg mt-2">
            Your images and videos, saved to your account. Pick images from here
            in the editor&apos;s image panel.
            {items && count > 0
              ? ` ${count} file${count === 1 ? "" : "s"} · ${formatBytes(totalBytes(items))}.`
              : ""}
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
          <button
            type="button"
            className="ps-media-drop"
            data-dragging={dragging ? "true" : undefined}
            onClick={() => fileRef.current?.click()}
          >
            <span className="ps-media-drop-icon" aria-hidden>
              <Images size={28} />
            </span>
            <span className="ps-title">Drop files here</span>
            <span className="ps-body">
              or click to choose files. Images (PNG, JPG, WebP, GIF, SVG) up to
              8 MB, scaled to 1920 px; videos (MP4, WebM) up to 100 MB.
            </span>
          </button>
        ) : (
          <>
            {/* Selection bar: select all, clear, delete the selected files. */}
            <div
              className="ps-media-bar"
              data-active={selecting ? "true" : undefined}
            >
              <button
                type="button"
                className="ps-btn ps-btn-xs"
                onClick={() =>
                  setSelected(
                    selected.size === count
                      ? new Set()
                      : new Set(items.map((m) => m.id)),
                  )
                }
              >
                <CheckSquare size={14} />{" "}
                {selected.size === count ? "Clear selection" : "Select all"}
              </button>
              {selecting ? (
                <>
                  <span className="ps-caption">{selected.size} selected</span>
                  <button
                    type="button"
                    className="ps-btn ps-btn-xs"
                    onClick={() => setSelected(new Set())}
                  >
                    <X size={14} /> Cancel
                  </button>
                  <button
                    type="button"
                    className="ps-btn ps-btn-xs ml-auto"
                    data-danger="true"
                    onClick={() =>
                      setConfirm(items.filter((m) => selected.has(m.id)))
                    }
                  >
                    <Trash size={14} /> Delete {selected.size}
                  </button>
                </>
              ) : (
                <span className="ps-caption">
                  Tick files to delete several at once.
                </span>
              )}
            </div>
            <ul
              className="ps-media-grid"
              aria-label="Media"
              data-dragging={dragging ? "true" : undefined}
              data-selecting={selecting ? "true" : undefined}
            >
              {items.map((m) => {
                const on = selected.has(m.id);
                return (
                  <li
                    key={m.id}
                    className="ps-media-tile"
                    data-selected={on ? "true" : undefined}
                  >
                    <div
                      className="ps-media-thumb"
                      onClick={selecting ? () => toggle(m.id) : undefined}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- remote thumbnail */}
                      <img src={m.thumb} alt={m.name} loading="lazy" />
                      <button
                        type="button"
                        className="ps-media-check"
                        role="checkbox"
                        aria-checked={on}
                        aria-label={`Select ${m.name}`}
                        onClick={(e) => (e.stopPropagation(), toggle(m.id))}
                      >
                        {on ? <Check size={12} weight="bold" /> : null}
                      </button>
                      <div className="ps-media-actions">
                        <button
                          type="button"
                          className="ps-iconbtn"
                          aria-label={`Rename ${m.name}`}
                          title="Rename"
                          onClick={(e) => (
                            e.stopPropagation(),
                            setRenaming({ id: m.id, name: m.name })
                          )}
                        >
                          <PencilSimple size={16} />
                        </button>
                        <button
                          type="button"
                          className="ps-iconbtn"
                          aria-label={`Download ${m.name}`}
                          title="Download"
                          onClick={(e) => (
                            e.stopPropagation(),
                            void download(m)
                          )}
                        >
                          <DownloadSimple size={16} />
                        </button>
                        <button
                          type="button"
                          className="ps-iconbtn"
                          data-danger="true"
                          aria-label={`Delete ${m.name}`}
                          title="Delete"
                          onClick={(e) => (
                            e.stopPropagation(),
                            setConfirm([m])
                          )}
                        >
                          <Trash size={16} />
                        </button>
                      </div>
                    </div>
                    {renaming?.id === m.id ? (
                      <input
                        className="ps-input mt-2 h-8 text-[13px]"
                        autoFocus
                        value={renaming.name}
                        maxLength={120}
                        aria-label="New name"
                        onChange={(e) =>
                          setRenaming({ id: m.id, name: e.target.value })
                        }
                        onBlur={() => void saveName()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void saveName();
                          if (e.key === "Escape") setRenaming(null);
                        }}
                      />
                    ) : (
                      <p
                        className="ps-media-name"
                        title={`${m.name} (double-click to rename)`}
                        onDoubleClick={() =>
                          setRenaming({ id: m.id, name: m.name })
                        }
                      >
                        {m.name}
                      </p>
                    )}
                    <p className="ps-cardcaption">
                      {m.kind === "video" && m.duration
                        ? `${formatDuration(m.duration)} · `
                        : ""}
                      {m.width}×{m.height} · {formatBytes(m.bytes)} ·{" "}
                      {timeAgo(m.addedAt)}
                    </p>
                  </li>
                );
              })}
            </ul>
            <p className="ps-caption mt-4">
              Drag images anywhere on this page to add them.
            </p>
          </>
        )}
      </div>

      <Dialog
        open={confirm !== null}
        onOpenChange={(open) => !open && !deleting && setConfirm(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirm && confirm.length > 1
                ? `Delete ${confirm.length} files?`
                : `Delete this ${confirm?.[0]?.kind ?? "file"}?`}
            </DialogTitle>
            <DialogDescription>
              {confirm && confirm.length > 1
                ? "They will be deleted from your storage."
                : `“${confirm?.[0]?.name ?? ""}” will be deleted from your storage.`}{" "}
              Slides that use them will show a broken image.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              className="ps-btn"
              onClick={() => setConfirm(null)}
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="ps-btn"
              data-danger="true"
              onClick={() => void remove()}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
