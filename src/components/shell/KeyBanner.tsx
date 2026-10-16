"use client";

import { useState } from "react";
import { X } from "@phosphor-icons/react";
import { useAiHealth } from "@/hooks/useAiHealth";

const STORAGE_KEY = "presenta:banner-dismissed";

function readDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Offline-mode notice shown at the top of the home content column when the
 * server has no ANTHROPIC_API_KEY: a plate strip with a warning dot (`.ps-banner`).
 * Dismissal persists in localStorage ("presenta:banner-dismissed").
 */
export function KeyBanner() {
  const health = useAiHealth();
  // Health is null during hydration, so reading localStorage lazily here never changes hydrated output.
  const [dismissed, setDismissed] = useState(() => typeof window !== "undefined" && readDismissed());

  if (!health || health.hasKey || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  return (
    <div role="status" className="ps-banner">
      <span className="size-2 shrink-0 rounded-full bg-[var(--ps-warning)]" aria-hidden />
      <p className="flex-1">
        Offline mock mode: add <code className="ps-banner-code">ANTHROPIC_API_KEY</code> or <code className="ps-banner-code">OPENAI_API_KEY</code> to <code className="ps-banner-code">.env.local</code> to enable AI generation.
      </p>
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="ps-iconbtn ps-iconbtn-sm">
        <X size={12} weight="bold" />
      </button>
    </div>
  );
}
