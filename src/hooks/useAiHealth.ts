"use client";

import { useEffect, useState } from "react";
import { getHealth, type AiHealth } from "@/lib/api-client";
import { KEY_CHANGED_EVENT } from "@/lib/ai-key";

/** Shown when the health check fails (offline, no server reachable): matches the UI's existing offline copy. */
const OFFLINE_HEALTH: AiHealth = { hasKey: false, model: "", provider: "mock", byok: false, serverKey: false };

let cached: AiHealth | null = null;
let pending: Promise<AiHealth> | null = null;

/** Fetch /api/health once per page load (again after the visitor's key changes); concurrent callers share the result. */
function fetchAiHealth(): Promise<AiHealth> {
  if (cached) return Promise.resolve(cached);
  pending ??= getHealth()
    .then((res) => {
      cached = res.ok ? res.data : OFFLINE_HEALTH;
      return cached;
    })
    .catch(() => (cached = OFFLINE_HEALTH))
    .finally(() => {
      pending = null;
    });
  return pending;
}

/** `null` until the health check answers; settles to the live result, or an offline fallback if the check fails. */
export function useAiHealth(): AiHealth | null {
  const [health, setHealth] = useState<AiHealth | null>(cached);
  useEffect(() => {
    let alive = true;
    const load = () =>
      void fetchAiHealth().then((h) => {
        if (alive) setHealth(h);
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
