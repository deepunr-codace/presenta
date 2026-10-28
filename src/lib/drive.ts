import { call, send } from "@/lib/collab";
import type { Analytics, EventKind, Folder } from "@/lib/drive-db";
import type { StorageUsage } from "@/lib/storage";

/** Browser-side calls for folders, storage, analytics and view tracking. The rules are enforced by the API routes. */

export type { Analytics, EventKind, Folder, StorageUsage };
export type AnalyticsResponse = Analytics & { storage: StorageUsage };

export const fetchFolders = () => call<{ folders: Folder[] }>("/api/folders", undefined, "Could not load your folders.").then((r) => r.folders);
export const createFolder = (name: string, parentId: string | null) => call<{ folder: Folder }>("/api/folders", send("POST", { name, parentId }), "Could not create the folder.").then((r) => r.folder);
export const renameFolder = (id: string, name: string) => call<{ ok: true }>(`/api/folders/${encodeURIComponent(id)}`, send("PATCH", { name }), "Could not rename the folder.");
export const moveFolder = (id: string, parentId: string | null) => call<{ ok: true }>(`/api/folders/${encodeURIComponent(id)}`, send("PATCH", { parentId }), "Could not move the folder.");
export const deleteFolder = (id: string) => call<{ ok: true }>(`/api/folders/${encodeURIComponent(id)}`, send("DELETE"), "Could not delete the folder.");
export const moveDeckToFolder = (deckId: string, folderId: string | null) => call<{ ok: true }>(`/api/decks/${encodeURIComponent(deckId)}`, send("PATCH", { folderId }), "Could not move the deck.");

export const fetchStorage = () => call<StorageUsage>("/api/storage", undefined, "Could not load your storage.");
export const fetchAnalytics = (days: 7 | 30 | 90) => call<AnalyticsResponse>(`/api/analytics?days=${days}`, undefined, "Could not load analytics.");

/** Tell the server I opened a deck. Never throws and never blocks the page: analytics are not worth an error. */
export function recordDeckEvent(deckId: string, kind: EventKind): void {
  void fetch(`/api/decks/${encodeURIComponent(deckId)}/events`, send("POST", { kind })).catch(() => undefined);
}

/* ---------- Folder tree helpers ---------- */

export const childrenOf = (folders: Folder[], parentId: string | null) => folders.filter((f) => f.parentId === parentId);

/** The folders from the top down to `id`, for a breadcrumb. */
export function pathTo(folders: Folder[], id: string | null): Folder[] {
  const path: Folder[] = [];
  for (let cur = id; cur; ) {
    const f = folders.find((x) => x.id === cur);
    if (!f) break;
    path.unshift(f);
    cur = f.parentId;
  }
  return path;
}

/** "Clients / Acme" for a folder id, or "" at the top level. */
export const pathLabel = (folders: Folder[], id: string | null) => pathTo(folders, id).map((f) => f.name).join(" / ");
