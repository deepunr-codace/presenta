"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowCounterClockwise, Trash } from "@phosphor-icons/react";
import { emptyTrash, listTrash, purgeDeck, restoreDeck, TRASH_RETENTION_DAYS, type TrashedDeck } from "@/lib/persist";
import { timeAgo } from "@/lib/time";
import { AppShell } from "@/components/shell/AppShell";
import { useToast } from "@/components/shell/Toast";
import { DeckThumb } from "@/components/home/DeckThumb";
import { useStoredDeck } from "@/components/home/useStoredDeck";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorNotice } from "@/components/ui-kit/ErrorNotice";

type Confirm = { kind: "one"; deck: TrashedDeck } | { kind: "all" } | null;

const DAY_MS = 24 * 60 * 60 * 1000;

function daysLeft(trashedAt: string): number {
  const left = TRASH_RETENTION_DAYS - Math.floor((Date.now() - Date.parse(trashedAt)) / DAY_MS);
  return Math.max(0, left);
}

function TrashCard({ deck, onRestore, onDelete }: { deck: TrashedDeck; onRestore: () => void; onDelete: () => void }) {
  const full = useStoredDeck(deck.id);
  const title = deck.title || "Untitled deck";
  const left = daysLeft(deck.trashedAt);
  return (
    <li className="ps-glass ps-trash-card" data-paper="">
      <DeckThumb deck={full} className="ps-trash-thumb" />
      <div className="mt-3 min-w-0">
        <h3 className="ps-title truncate" title={title}>
          {title}
        </h3>
        <p className="ps-cardcaption">
          Deleted {timeAgo(deck.trashedAt)} · {left} day{left === 1 ? "" : "s"} left
        </p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="ps-btn ps-btn-xs" onClick={onRestore}>
          <ArrowCounterClockwise /> Restore
        </button>
        <button type="button" className="ps-btn ps-btn-xs" data-danger="true" onClick={onDelete}>
          <Trash /> Delete forever
        </button>
      </div>
    </li>
  );
}

/** Trash at /trash: decks moved here can be restored or deleted for good; they are purged after 30 days. */
export function TrashScreen() {
  const { toast } = useToast();
  const [items, setItems] = useState<TrashedDeck[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);

  const refresh = useCallback(async () => {
    try {
      setItems(await listTrash());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read the trash.");
      setItems([]);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    listTrash()
      .then((list) => alive && setItems(list))
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Could not read the trash.");
        setItems([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const act = async (fn: () => Promise<void>, message: string) => {
    setError(null);
    try {
      await fn();
      await refresh();
      toast(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  const onConfirm = () => {
    const target = confirm;
    setConfirm(null);
    if (!target) return;
    if (target.kind === "all") void act(emptyTrash, "Trash emptied.");
    else void act(() => purgeDeck(target.deck.id), "Deck deleted for good.");
  };

  const count = items?.length ?? 0;

  return (
    <AppShell
      active="trash"
      sidebar="full"
      breadcrumbs={[{ label: "Studio", href: "/" }, { label: "Trash" }]}
      actions={
        <Button variant="outline" size="sm" className="ps-btn ps-btn-xs" data-danger="true" onClick={() => setConfirm({ kind: "all" })} disabled={count === 0}>
          <Trash data-icon="inline-start" /> Empty trash
        </Button>
      }
    >
      <div className="ps-page">
        <header className="mb-8">
          <h1 className="ps-heading">Trash</h1>
          <p className="ps-body-lg mt-2">Decks you delete wait here for {TRASH_RETENTION_DAYS} days, then are removed for good.</p>
        </header>

        {error ? <ErrorNotice compact className="mb-4" message={error} /> : null}

        {items === null ? (
          <div className="ps-trash-grid" aria-hidden>
            <div className="ps-glass h-56 animate-pulse" />
            <div className="ps-glass h-56 animate-pulse" />
            <div className="ps-glass h-56 animate-pulse" />
          </div>
        ) : count === 0 ? (
          <div className="ps-glass ps-emptystate" role="status">
            <div className="ps-fan" aria-hidden>
              <span />
              <span />
              <span />
            </div>
            <h3 className="ps-title">Trash is empty</h3>
            <p className="ps-body max-w-md">Decks you delete from the home page show up here, so you can bring them back.</p>
          </div>
        ) : (
          <ul className="ps-trash-grid" aria-label="Deleted decks">
            {items.map((d) => (
              <TrashCard
                key={d.id}
                deck={d}
                onRestore={() => void act(async () => void (await restoreDeck(d.id)), "Deck restored.")}
                onDelete={() => setConfirm({ kind: "one", deck: d })}
              />
            ))}
          </ul>
        )}
      </div>

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm?.kind === "all" ? "Empty the trash?" : "Delete this deck for good?"}</DialogTitle>
            <DialogDescription>
              {confirm?.kind === "all"
                ? `All ${count} deck${count === 1 ? "" : "s"} in the trash will be deleted. This cannot be undone.`
                : confirm?.kind === "one"
                  ? `“${confirm.deck.title || "Untitled deck"}” will be deleted for good. This cannot be undone.`
                  : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onConfirm}>
              Delete forever
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
