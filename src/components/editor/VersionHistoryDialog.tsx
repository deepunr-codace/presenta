"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ClockCounterClockwise, FloppyDisk, ArrowUUpLeft } from "@phosphor-icons/react";
import { createDeckCheckpoint, fetchDeckVersions, restoreDeckVersion, type DeckVersionSummary } from "@/lib/collab";
import { flushSave, useDeckStore } from "@/store/deck-store";
import { useToast } from "@/components/shell/Toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = { id: string; open: boolean; onOpenChange: (open: boolean) => void };

export function VersionHistoryDialog({ id, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const loadDeck = useDeckStore((s) => s.loadDeck);
  const [versions, setVersions] = useState<DeckVersionSummary[]>([]);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    fetchDeckVersions(id).then((items) => alive && setVersions(items)).catch((e: unknown) => alive && setError(e instanceof Error ? e.message : "Could not load version history."));
    return () => { alive = false; };
  }, [open, id]);

  const requireSaved = async () => {
    await flushSave();
    const message = useDeckStore.getState().saveError;
    if (message) throw new Error(message);
  };

  const checkpoint = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await requireSaved();
      setVersions(await createDeckCheckpoint(id, label.trim() || "Checkpoint"));
      setLabel("");
      toast("Checkpoint saved.", { tone: "success" });
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save this checkpoint."); }
    finally { setBusy(false); }
  };

  const restore = async (version: DeckVersionSummary) => {
    setBusy(true);
    setRestoringId(version.id);
    setError(null);
    try {
      await requireSaved();
      const result = await restoreDeckVersion(id, version.id);
      loadDeck(result.deck);
      setVersions(result.versions);
      toast(`Restored “${version.label}”.`, { tone: "success" });
    } catch (e) { setError(e instanceof Error ? e.message : "Could not restore this version."); }
    finally { setBusy(false); setRestoringId(null); }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><ClockCounterClockwise size={20} /> Version history</DialogTitle>
        <DialogDescription>Presenta saves an automatic checkpoint every five minutes while you edit. You can also name a checkpoint before a major change. Up to 100 versions are kept.</DialogDescription>
      </DialogHeader>
      {error ? <p role="alert" className="ps-caption" style={{ color: "var(--ps-danger)" }}>{error}</p> : null}
      <form className="flex gap-2" onSubmit={(e) => void checkpoint(e)}>
        <input className="ps-input min-w-0 flex-1" maxLength={80} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Name this checkpoint (optional)" aria-label="Checkpoint name" />
        <button type="submit" className="ps-btn ps-btn-primary ps-btn-xs" disabled={busy}><FloppyDisk size={13} /> Save</button>
      </form>
      <div className="max-h-[45vh] overflow-y-auto">
        {versions.length ? <ul className="flex flex-col divide-y divide-[var(--ps-line)]">{versions.map((v) => <li key={v.id} className="flex items-center gap-3 py-3">
          <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-medium">{v.label}</p><p className="ps-caption">{v.name} · {new Date(v.createdAt).toLocaleString()}</p></div>
          <button type="button" className="ps-btn ps-btn-xs" disabled={busy} onClick={() => void restore(v)} title={`Restore ${v.label}`}><ArrowUUpLeft size={13} /> {restoringId === v.id ? "Restoring…" : "Restore"}</button>
        </li>)}</ul> : <p className="ps-body py-8 text-center">No saved versions yet. Your first automatic checkpoint is created after you make a change.</p>}
      </div>
    </DialogContent>
  </Dialog>;
}
