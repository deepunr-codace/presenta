"use client";

import { useMemo, useSyncExternalStore } from "react";
import { STARRED_EVENT, getStarredRaw, parseStarred } from "@/lib/starred";

function subscribe(onChange: () => void): () => void {
  window.addEventListener(STARRED_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(STARRED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Ids of starred decks, newest star first. Empty during server rendering and hydration. */
export function useStarred(): string[] {
  const raw = useSyncExternalStore(subscribe, getStarredRaw, () => null);
  return useMemo(() => parseStarred(raw), [raw]);
}

const noopSubscribe = () => () => {};

/** True on Apple platforms, for showing ⌘ instead of Ctrl. False on the server and during hydration. */
export function useIsMac(): boolean {
  return useSyncExternalStore(noopSubscribe, () => /Mac|iPhone|iPad/.test(navigator.platform), () => false);
}
