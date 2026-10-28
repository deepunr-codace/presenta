import { afterEach, describe, expect, it, vi } from "vitest";
import { dataUrlBytes, deleteMedia, formatBytes, formatDuration, listMedia, totalBytes, type MediaItem } from "../media";

const item = (id: string, addedAt: string, bytes = 1000): MediaItem => ({
  id,
  name: id,
  kind: "image",
  mime: "image/png",
  bytes,
  width: 10,
  height: 10,
  duration: null,
  addedAt,
  url: `https://cdn.example/${id}.png`,
  thumb: `https://cdn.example/${id}.thumb.png`,
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

afterEach(() => vi.unstubAllGlobals());

describe("media library API", () => {
  it("lists items newest first", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ items: [item("a", "2026-01-01T00:00:00.000Z"), item("b", "2026-02-01T00:00:00.000Z")] })));
    expect((await listMedia()).map((m) => m.id)).toEqual(["b", "a"]);
  });

  it("surfaces the server's error message", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "Not signed in." }, 401)));
    await expect(listMedia()).rejects.toThrow("Not signed in.");
  });

  it("deletes through the API", async () => {
    const fetchMock = vi.fn(async () => json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    await deleteMedia("media_1");
    expect(fetchMock).toHaveBeenCalledWith("/api/media/media_1", { method: "DELETE" });
  });

  it("fails a delete the server refused", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "That item was not found." }, 404)));
    await expect(deleteMedia("nope")).rejects.toThrow("not found");
  });
});

describe("media helpers", () => {
  it("sums sizes and formats them", () => {
    expect(totalBytes([item("a", "x", 1500), item("b", "y", 2500)])).toBe(4000);
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.0 MB");
  });

  it("formats video durations", () => {
    expect(formatDuration(42)).toBe("0:42");
    expect(formatDuration(725)).toBe("12:05");
  });

  it("measures the payload of a base64 data URL", () => {
    expect(dataUrlBytes("data:image/png;base64,QUJD")).toBe(3);
    expect(dataUrlBytes("data:image/png;base64,QUI=")).toBe(2);
    expect(dataUrlBytes("data:image/png;base64,QQ==")).toBe(1);
  });
});
