"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const THEME_STORAGE_KEY = "presenta:theme";
const MEDIA_QUERY = "(prefers-color-scheme: dark)";

type ThemeState = { mode: ThemeMode; resolved: ResolvedTheme };

/*
 * The mode lives in a small module store so `useThemeMode()` can use
 * useSyncExternalStore: the server snapshot is a constant, the client snapshot
 * is read after hydration, and `data-theme` on <html> is already correct before
 * React runs thanks to the inline script in layout.tsx.
 */
const SERVER_STATE: ThemeState = { mode: "system", resolved: "light" };
let state: ThemeState = SERVER_STATE;
const listeners = new Set<() => void>();

function isMode(v: unknown): v is ThemeMode {
  return v === "light" || v === "dark" || v === "system";
}

function readStoredMode(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return isMode(v) ? v : "system";
  } catch {
    return "system";
  }
}

function systemTheme(): ResolvedTheme {
  return typeof window !== "undefined" && window.matchMedia(MEDIA_QUERY).matches ? "dark" : "light";
}

function resolve(mode: ThemeMode): ResolvedTheme {
  return mode === "system" ? systemTheme() : mode;
}

function commit(next: ThemeState): void {
  if (next.mode === state.mode && next.resolved === state.resolved) return;
  state = next;
  document.documentElement.dataset.theme = next.resolved;
  listeners.forEach((l) => l());
}

/** Set the mode and persist it to localStorage. */
function setThemeMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    /* private mode or quota: keep it for this page only */
  }
  commit({ mode, resolved: resolve(mode) });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => state;
const getServerSnapshot = () => SERVER_STATE;

type ThemeModeApi = ThemeState & { setMode: (mode: ThemeMode) => void };

const ThemeModeContext = createContext<ThemeModeApi | null>(null);

type Props = { children: ReactNode };

/**
 * Owns the chrome mode: reads `presenta:theme`, keeps `data-theme` on <html>
 * in sync, follows the OS preference while the mode is "system" and mirrors
 * changes made in other tabs.
 */
export function ThemeModeProvider({ children }: Props) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    const stored = readStoredMode();
    commit({ mode: stored, resolved: resolve(stored) });

    const mql = window.matchMedia(MEDIA_QUERY);
    const onMedia = () => {
      if (state.mode === "system") commit({ mode: "system", resolved: systemTheme() });
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key !== THEME_STORAGE_KEY) return;
      const mode = readStoredMode();
      commit({ mode, resolved: resolve(mode) });
    };
    mql.addEventListener("change", onMedia);
    window.addEventListener("storage", onStorage);
    return () => {
      mql.removeEventListener("change", onMedia);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const api = useMemo<ThemeModeApi>(() => ({ ...snapshot, setMode: setThemeMode }), [snapshot]);

  return <ThemeModeContext.Provider value={api}>{children}</ThemeModeContext.Provider>;
}

/** `{ mode, resolved, setMode }`: mode is what the user chose, resolved is what is painted. */
export function useThemeMode(): ThemeModeApi {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) throw new Error("useThemeMode must be used inside <ThemeModeProvider>");
  return ctx;
}
