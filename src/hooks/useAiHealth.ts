"use client";

import { useEffect, useState } from "react";
import { getHealth, type AiHealth } from "@/lib/api-client";
import { KEY_CHANGED_EVENT } from "@/lib/ai-key";

let cached: AiHealth | null = null;
let pending: Promise<AiHealth | null> | null = null;

/** Fetch /api/health once per page load (again after the visitor's key changes); concurrent callers share the result. */
function fetchAiHealth(): Promise<AiHealth | null> {
  if (cached) return Promise.resolve(cached);
  pending ??= getHealth()
    .then((res) => {
      if (!res.ok) return null;
      cached = res.data;
      return res.data;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

/** `null` until the health check answers (or if it fails). */
export function useAiHealth(): AiHealth | null {
  const [health, setHealth] = useState<AiHealth | null>(cached);
  useEffect(() => {
    let alive = true;
    const load = () =>
      void fetchAiHealth().then((h) => {
        if (alive && h) setHealth(h);
      });
    const onKeyChange = () => {
      cached = null;
      pending = null;
      load();
    };
    load();
    window.addEventListener(KEY_CHANGED_EVENT, onKeyChange);
    return () => {
      alive = false;
      window.removeEventListener(KEY_CHANGED_EVENT, onKeyChange);
    };
  }, []);
  return health;
}
