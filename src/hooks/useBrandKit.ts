"use client";

import { useMemo, useSyncExternalStore } from "react";
import { BRAND_KIT_EVENT, getBrandKitRaw, parseBrandKit, type BrandKit } from "@/lib/brand-kit";

function subscribe(onChange: () => void): () => void {
  window.addEventListener(BRAND_KIT_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(BRAND_KIT_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The saved brand kit, or null. Always null during server rendering and hydration, then the stored kit. */
export function useBrandKit(): BrandKit | null {
  const raw = useSyncExternalStore(subscribe, getBrandKitRaw, () => null);
  return useMemo(() => parseBrandKit(raw), [raw]);
}

const noopSubscribe = () => () => {};

/** False on the server and during hydration, true afterwards; for gating UI that reads browser storage. */
export function useMounted(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
