"use client";

import { useMemo, useState } from "react";
import { FolderSimple, HardDrives } from "@phosphor-icons/react";
import { childrenOf, type Folder } from "@/lib/drive";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = {
  title: string;
  folders: Folder[];
  /** Where the item is now; that place is shown but cannot be chosen. */
  currentFolderId: string | null;
  /** Folders that are not valid destinations (a folder being moved and everything inside it). */
  disabledIds?: Set<string>;
  onMove: (folderId: string | null) => Promise<void>;
  onClose: () => void;
};

type Row = { id: string | null; name: string; depth: number };

/** A folder tree to pick a destination from, like the "Move to" window of a file manager. Mount it only while it is open. */
export function MoveDialog({ title, folders, currentFolderId, disabledIds, onMove, onClose }: Props) {
  const [choice, setChoice] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => {
    const out: Row[] = [{ id: null, name: "My decks", depth: 0 }];
    const walk = (parent: string | null, depth: number) => {
      for (const f of childrenOf(folders, parent)) {
        out.push({ id: f.id, name: f.name, depth });
        walk(f.id, depth + 1);
      }
    };
    walk(null, 1);
    return out;
  }, [folders]);

  const submit = async () => {
    if (choice === undefined || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onMove(choice);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not move it.");
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Choose where to put it.</DialogDescription>
        </DialogHeader>
        <ul className="max-h-72 overflow-y-auto rounded-[var(--ps-r-md)] border border-[var(--ps-line)] p-1" role="listbox" aria-label="Destination">
          {rows.map((r) => {
            const here = r.id === currentFolderId;
            const blocked = here || (r.id !== null && disabledIds?.has(r.id));
            const selected = choice === r.id;
            return (
              <li key={r.id ?? "root"} role="option" aria-selected={selected}>
                <button
                  type="button"
                  className="ps-panel-row"
                  data-active={selected ? "true" : undefined}
                  disabled={blocked}
                  style={{ paddingLeft: 12 + r.depth * 18, opacity: blocked ? 0.5 : 1 }}
                  onClick={() => setChoice(r.id)}
                >
                  {r.id === null ? <HardDrives size={18} weight="light" /> : <FolderSimple size={18} weight="light" />}
                  <span className="min-w-0 flex-1 truncate text-left">{r.name}</span>
                  {here ? <span className="ps-caption">Current</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
        {error ? (
          <p className="ps-caption" role="alert" style={{ color: "var(--ps-danger)" }}>
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <button type="button" className="ps-btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="ps-btn ps-btn-primary" onClick={() => void submit()} disabled={busy || choice === undefined}>
            Move here
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
