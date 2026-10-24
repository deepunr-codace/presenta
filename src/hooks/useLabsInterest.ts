"use client";

import { useMemo, useSyncExternalStore } from "react";
import { LABS_EVENT, getLabsRaw, parseLabs } from "@/lib/labs-interest";

function subscribe(onChange: () => void): () => void {
  window.addEventListener(LABS_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(LABS_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Ids of the Labs features the visitor asked to be told about. Empty during server rendering and hydration. */
export function useLabsInterest(): string[] {
  const raw = useSyncExternalStore(subscribe, getLabsRaw, () => null);
  return useMemo(() => parseLabs(raw), [raw]);
}
