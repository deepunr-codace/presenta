/**
 * Starred decks: a list of deck ids kept in this browser (localStorage, "presenta:starred").
 * Ids of decks that no longer exist are ignored wherever the list is shown.
 */

export const STARRED_KEY = "presenta:starred";
export const STARRED_EVENT = "presenta:starred-changed";

/** The stored list as raw text (a stable primitive, so it suits `useSyncExternalStore`). */
export function getStarredRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STARRED_KEY);
  } catch {
    return null;
  }
}

export function parseStarred(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Star or unstar a deck; returns the new list. Throws if the browser refuses to store it. */
export function toggleStarred(id: string): string[] {
  const current = parseStarred(getStarredRaw());
  const next = current.includes(id) ? current.filter((x) => x !== id) : [id, ...current];
  window.localStorage.setItem(STARRED_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(STARRED_EVENT));
  return next;
}
