import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory stand-in for IndexedDB (idb-keyval's get/set/del/update).
const store = new Map<string, unknown>();
vi.mock("idb-keyval", () => ({
  get: async (k: string) => store.get(k),
  set: async (k: string, v: unknown) => void store.set(k, v),
  del: async (k: string) => void store.delete(k),
  update: async (k: string, fn: (v: unknown) => unknown) => void store.set(k, fn(store.get(k))),
}));

import { dataUrlBytes, deleteMedia, formatBytes, getMediaData, listMedia, mediaKey, saveMediaRecord, totalBytes, type MediaItem } from "../media";

const item = (id: string, addedAt: string, bytes = 1000): MediaItem => ({ id, name: id, mime: "image/png", bytes, width: 10, height: 10, addedAt, thumb: "data:image/png;base64,AAAA" });

beforeEach(() => store.clear());

describe("media library storage", () => {
  it("saves an image and lists it newest first", async () => {
    await saveMediaRecord(item("a", "2026-01-01T00:00:00.000Z"), "data:image/png;base64,AAAA");
    await saveMediaRecord(item("b", "2026-02-01T00:00:00.000Z"), "data:image/png;base64,BBBB");
    expect((await listMedia()).map((m) => m.id)).toEqual(["b", "a"]);
    expect(await getMediaData("a")).toBe("data:image/png;base64,AAAA");
  });

  it("replaces an item saved twice instead of duplicating it", async () => {
    await saveMediaRecord(item("a", "2026-01-01T00:00:00.000Z"), "data:image/png;base64,AAAA");
    await saveMediaRecord(item("a", "2026-03-01T00:00:00.000Z"), "data:image/png;base64,CCCC");
    expect(await listMedia()).toHaveLength(1);
    expect(await getMediaData("a")).toBe("data:image/png;base64,CCCC");
  });

  it("deletes the image and its index entry", async () => {
    await saveMediaRecord(item("a", "2026-01-01T00:00:00.000Z"), "data:image/png;base64,AAAA");
    await deleteMedia("a");
    expect(await listMedia()).toEqual([]);
    expect(store.has(mediaKey("a"))).toBe(false);
    expect(await getMediaData("a")).toBeNull();
  });
});

describe("media helpers", () => {
  it("sums sizes and formats them", () => {
    expect(totalBytes([item("a", "x", 1500), item("b", "y", 2500)])).toBe(4000);
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.0 MB");
  });

  it("measures the payload of a base64 data URL", () => {
    expect(dataUrlBytes("data:image/png;base64,QUJD")).toBe(3);
    expect(dataUrlBytes("data:image/png;base64,QUI=")).toBe(2);
    expect(dataUrlBytes("data:image/png;base64,QQ==")).toBe(1);
  });
});
