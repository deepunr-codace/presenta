"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, lockApi, type PendingRequest } from "@/lib/collab";
import { flushSave } from "@/store/deck-store";

/**
 * One person edits a deck at a time. This hook asks the server for the edit lock when the editor opens, keeps it
 * alive while the editor is open, and runs the hand-over: someone who finds the deck taken can ask the holder to
 * hand over, and the holder's changes are saved before the lock moves.
 */

export type LockPhase =
  | { kind: "checking" }
  | { kind: "editing" }
  | { kind: "held"; holderName: string }
  | { kind: "waiting"; holderName: string; requestId: string }
  | { kind: "denied"; holderName: string }
  /** Someone else holds the lock now (we were handed over or went quiet too long). */
  | { kind: "lost" }
  | { kind: "handed"; to: string }
  /** The server says this person may view but not edit. */
  | { kind: "readonly" };

/** How often the holder tells the server it is still here. The server drops a holder after 20 s of silence. */
const HEARTBEAT_MS = 5_000;
/** How often someone waiting for a hand-over checks for an answer. */
const POLL_MS = 2_000;

export function useEditLock(id: string, enabled: boolean) {
  const [phase, setPhase] = useState<LockPhase>({ kind: "checking" });
  const [incoming, setIncoming] = useState<PendingRequest | null>(null);
  const holding = useRef(false);

  const editing = phase.kind === "editing";
  const waitingFor = phase.kind === "waiting" ? phase : null;

  const become = useCallback((next: LockPhase) => {
    holding.current = next.kind === "editing";
    setPhase(next);
  }, []);

  // Ask for the lock when the editor opens.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    lockApi
      .acquire(id)
      .then((r) => {
        if (!cancelled) become(r.state === "mine" ? { kind: "editing" } : { kind: "held", holderName: r.holderName });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // A viewer cannot hold the lock. Any other failure (offline, server error): let them edit; the server still refuses a save that clashes.
        become(err instanceof ApiError && (err.status === 403 || err.status === 404) ? { kind: "readonly" } : { kind: "editing" });
      });
    return () => {
      cancelled = true;
    };
  }, [id, enabled, become]);

  // While editing: keep the lock alive and listen for take-over requests.
  useEffect(() => {
    if (!editing) return;
    const timer = setInterval(() => {
      lockApi
        .heartbeat(id)
        .then((r) => {
          if (r.lost) {
            become({ kind: "lost" });
            return;
          }
          setIncoming((prev) => (prev?.id === r.request?.id ? prev : r.request));
        })
        .catch(() => undefined); // a blip in the connection: the next beat tries again
    }, HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, [id, editing, become]);

  // While waiting for the holder's answer.
  const requestId = waitingFor?.requestId;
  const holderName = waitingFor?.holderName;
  useEffect(() => {
    if (!requestId || !holderName) return;
    const timer = setInterval(() => {
      lockApi
        .status(id, requestId)
        .then(async (status) => {
          if (status === "allowed") become({ kind: "editing" });
          else if (status === "denied") become({ kind: "denied", holderName });
          else if (status === "expired") become({ kind: "held", holderName });
          else if (status === "free") {
            // The holder left or went quiet: the lock is free to take.
            const r = await lockApi.acquire(id);
            become(r.state === "mine" ? { kind: "editing" } : { kind: "held", holderName: r.holderName });
          }
        })
        .catch(() => undefined);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [id, requestId, holderName, become]);

  // Let go of the lock when leaving: after the last save when navigating away, immediately when the tab closes.
  useEffect(() => {
    const onHide = () => {
      if (holding.current) lockApi.releaseOnExit(id);
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      if (holding.current) {
        holding.current = false;
        void flushSave().finally(() => void lockApi.release(id).catch(() => undefined));
      }
    };
  }, [id]);

  const requestEdit = useCallback(async () => {
    if (phase.kind !== "held" && phase.kind !== "denied") return;
    const name = phase.holderName;
    try {
      const { requestId: rid } = await lockApi.request(id);
      become({ kind: "waiting", holderName: name, requestId: rid });
    } catch {
      become({ kind: "held", holderName: name });
    }
  }, [id, phase, become]);

  const cancelRequest = useCallback(() => {
    if (phase.kind === "waiting") become({ kind: "held", holderName: phase.holderName });
  }, [phase, become]);

  /** The holder answers a request. Allowing saves first, then moves the lock to the requester. */
  const respond = useCallback(
    async (allow: boolean) => {
      const req = incoming;
      if (!req) return;
      setIncoming(null);
      try {
        if (allow) await flushSave();
        await lockApi.respond(id, req.id, allow);
        if (allow) become({ kind: "handed", to: req.requesterName });
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) become({ kind: "lost" });
      }
    },
    [id, incoming, become],
  );

  return { phase, incoming, requestEdit, cancelRequest, respond };
}
