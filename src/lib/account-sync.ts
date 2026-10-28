import { get } from "idb-keyval";
import { parseBrandKit, getBrandKit, setBrandKitLocal } from "@/lib/brand-kit";
import { DeckSchema } from "@/lib/deck/schema";
import { addMediaFile } from "@/lib/media";
import { listTrash, saveDeck, trashDeck } from "@/lib/persist";
import { fetchSettings, putSettings } from "@/lib/settings-api";
import { getStarredRaw, parseStarred, setStarredLocal } from "@/lib/starred";

/**
 * Runs once per sign-in in the browser. It (1) makes this browser's cached brand kit and starred list match the
 * account, clearing them if a different user last used the browser, and (2) the first time an account is used on
 * a browser that already held decks, uploads those decks and library images to the account.
 */

const OWNER_KEY = "presenta:owner";
const migratedKey = (userId: string) => `presenta:migrated:${userId}`;

/** Keys the app used before accounts existed, when everything was kept in IndexedDB. */
const LEGACY_DECK_INDEX = "presenta:decks";
const LEGACY_TRASH_INDEX = "presenta:trash";
const LEGACY_MEDIA_INDEX = "presenta:media";
const legacyDeckKey = (id: string) => `presenta:deck:${id}`;
const legacyMediaKey = (id: string) => `presenta:media:${id}`;

function readOwner(): string | null {
  try {
    return window.localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}

/** Align the local cache with the account. Returns the user id that held this browser before, if any. */
async function syncSettings(userId: string): Promise<string | null> {
  const previousOwner = readOwner();
  const switched = previousOwner !== null && previousOwner !== userId;
  const remote = await fetchSettings();

  const patch: { brandKit?: ReturnType<typeof getBrandKit>; starred?: string[] } = {};

  const remoteKit = remote.brandKit ? parseBrandKit(JSON.stringify(remote.brandKit)) : null;
  if (remoteKit) setBrandKitLocal(remoteKit);
  else if (switched) setBrandKitLocal(null);
  else {
    const local = getBrandKit();
    if (local) patch.brandKit = local;
  }

  if (remote.starred !== null) setStarredLocal(remote.starred);
  else if (switched) setStarredLocal([]);
  else {
    const local = parseStarred(getStarredRaw());
    if (local.length) patch.starred = local;
  }

  if (patch.brandKit || patch.starred) await putSettings(patch);
  try {
    window.localStorage.setItem(OWNER_KEY, userId);
  } catch {
    /* ignore */
  }
  return previousOwner;
}

type LegacySummary = { id: string; title?: string };

/** Upload decks and library images that were saved in this browser before accounts. Returns how many items moved. */
async function migrateLegacy(userId: string): Promise<number> {
  const flag = migratedKey(userId);
  try {
    if (window.localStorage.getItem(flag)) return 0;
  } catch {
    return 0;
  }

  let moved = 0;
  const [index, trash, media] = await Promise.all([get<LegacySummary[]>(LEGACY_DECK_INDEX), get<LegacySummary[]>(LEGACY_TRASH_INDEX), get<{ id: string; name?: string }[]>(LEGACY_MEDIA_INDEX)]);
  const decks = [...(Array.isArray(index) ? index : []).map((d) => ({ id: d.id, trashed: false })), ...(Array.isArray(trash) ? trash : []).map((d) => ({ id: d.id, trashed: true }))];

  if (decks.length) {
    const existing = new Set([...(await listTrash()).map((d) => d.id)]);
    const listRes = await fetch("/api/decks?ids=1", { cache: "no-store" });
    if (listRes.ok) ((await listRes.json()) as { ids?: string[] }).ids?.forEach((id) => existing.add(id));
    for (const entry of decks) {
      if (existing.has(entry.id)) continue;
      const parsed = DeckSchema.safeParse(await get<unknown>(legacyDeckKey(entry.id)));
      if (!parsed.success) continue;
      await saveDeck(parsed.data);
      if (entry.trashed) await trashDeck(entry.id);
      moved += 1;
    }
  }

  for (const item of Array.isArray(media) ? media : []) {
    const dataUrl = await get<unknown>(legacyMediaKey(item.id));
    if (typeof dataUrl !== "string") continue;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      await addMediaFile(new File([blob], `${item.name ?? "Image"}.${blob.type.split("/")[1]?.replace("svg+xml", "svg") ?? "png"}`, { type: blob.type }));
      moved += 1;
    } catch {
      /* skip an image the library refuses; the original stays in this browser */
    }
  }

  try {
    window.localStorage.setItem(flag, new Date().toISOString());
  } catch {
    /* ignore */
  }
  return moved;
}

/** Entry point. Returns true if legacy browser data was uploaded (the page should reload its lists). */
export async function syncAccount(userId: string): Promise<boolean> {
  const previousOwner = await syncSettings(userId);
  // Only the first account to use a browser adopts what was saved in it before accounts existed.
  if (previousOwner !== null && previousOwner !== userId) return false;
  return (await migrateLegacy(userId)) > 0;
}
