"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Trash, WarningOctagon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorNotice } from "@/components/ui-kit/ErrorNotice";

/** Permanently deletes the account; on confirm, signs out and sends the user to /login. */
export function DangerZoneCard() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) {
        setError("Could not delete the account. Try again.");
        setBusy(false);
        return;
      }
      await signOut({ callbackUrl: "/login" });
    } catch {
      setError("Could not reach the server. Try again.");
      setBusy(false);
    }
  };

  return (
    <section className="ps-glass" data-paper>
      <div className="ps-glass-head">
        <span className="ps-iconchip" style={{ color: "var(--ps-danger)" }}>
          <WarningOctagon size={16} />
        </span>
        <h2 className="ps-cardtitle">Delete account</h2>
      </div>
      <p className="ps-body mb-4">Permanently deletes your Presenta account, sign-in, decks, brand kit and uploaded media. This cannot be undone.</p>
      {error ? <ErrorNotice compact className="mb-4" message={error} /> : null}
      <button type="button" className="ps-btn ps-btn-xs" data-danger="true" onClick={() => setOpen(true)}>
        <Trash /> Delete account
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>This permanently removes your account and sign-in. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void onConfirm()} disabled={busy}>
              {busy ? "Deleting…" : "Delete account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
