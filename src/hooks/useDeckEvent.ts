"use client";

import { useEffect } from "react";
import { recordDeckEvent, type EventKind } from "@/lib/drive";

/** Count one view (or presentation) of a deck, once the deck has loaded. Feeds the owner's analytics. */
export function useDeckEvent(id: string, kind: EventKind, ready: boolean): void {
  useEffect(() => {
    if (ready) recordDeckEvent(id, kind);
  }, [id, kind, ready]);
}
