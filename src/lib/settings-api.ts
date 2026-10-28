import type { BrandKit } from "@/lib/brand-kit";

/**
 * Fire-and-forget writes of per-account settings to /api/settings. The local copy (localStorage) is the one the UI
 * reads, so a failed write here is never shown as an error; the next sign-in sync reconciles the two.
 */

export type RemoteSettings = { brandKit: unknown | null; starred: string[] | null };

export async function fetchSettings(): Promise<RemoteSettings> {
  const res = await fetch("/api/settings", { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load your settings.");
  return (await res.json()) as RemoteSettings;
}

export async function putSettings(patch: { brandKit?: BrandKit | null; starred?: string[] | null }): Promise<void> {
  try {
    await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
  } catch {
    /* offline or signed out: the next sync catches up */
  }
}
