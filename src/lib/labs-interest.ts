/**
 * Which Labs features the visitor wants ("Notify me"), kept in this browser only
 * (localStorage, "presenta:labs-interest"). Nothing is sent anywhere.
 */

export const LABS_KEY = "presenta:labs-interest";
export const LABS_EVENT = "presenta:labs-interest-changed";

/** The stored list as raw text (a stable primitive, so it suits `useSyncExternalStore`). */
export function getLabsRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(LABS_KEY);
  } catch {
    return null;
  }
}

export function parseLabs(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Add or remove a feature id; returns the new list. Throws if the browser refuses to store it. */
export function toggleLabsInterest(id: string): string[] {
  const current = parseLabs(getLabsRaw());
  const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
  window.localStorage.setItem(LABS_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(LABS_EVENT));
  return next;
}
