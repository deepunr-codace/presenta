"use client";

import { useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = {
  title: string;
  description?: string;
  label: string;
  initial?: string;
  confirmLabel: string;
  /** Resolve to close the dialog; throw an Error to show its message and keep it open. */
  onSubmit: (name: string) => Promise<void>;
  onClose: () => void;
};

/** A one-field dialog for naming something (a new folder, a rename). Mount it only while it is open. */
export function NameDialog({ title, description, label, initial = "", confirmLabel, onSubmit, onClose }: Props) {
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(name.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
          <div className="ps-auth-field">
            <label htmlFor="name-dialog-input" className="ps-label">
              {label}
            </label>
            <input id="name-dialog-input" className="ps-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus onFocus={(e) => e.currentTarget.select()} />
            {error ? (
              <p className="ps-caption mt-1" role="alert" style={{ color: "var(--ps-danger)" }}>
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <button type="button" className="ps-btn" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="ps-btn ps-btn-primary" disabled={busy || !name.trim()}>
              {confirmLabel}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
