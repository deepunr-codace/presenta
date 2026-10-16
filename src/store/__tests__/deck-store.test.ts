import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Deck, TextElement } from "@/lib/deck/schema";

/* ---- in-memory idb-keyval ---- */
const memory = new Map<IDBValidKey, unknown>();
vi.mock("idb-keyval", () => ({
  get: vi.fn(async (key: IDBValidKey) => memory.get(key)),
  set: vi.fn(async (key: IDBValidKey, value: unknown) => {
    memory.set(key, structuredClone(value));
  }),
  del: vi.fn(async (key: IDBValidKey) => {
    memory.delete(key);
  }),
  update: vi.fn(async (key: IDBValidKey, updater: (old: unknown) => unknown) => {
    memory.set(key, structuredClone(updater(memory.get(key))));
  }),
}));

/* ---- Task 1 stand-ins ---- */
vi.mock("@/lib/deck/layouts", async () => {
  const f = await import("@/lib/deck/__tests__/fixtures");
  return { applyLayout: f.stubApplyLayout, buildSlide: f.stubBuildSlide };
});
vi.mock("@/lib/deck/themes", async () => {
  const f = await import("@/lib/deck/__tests__/fixtures");
  return { getTheme: f.stubGetTheme, THEMES: {} };
});
vi.mock("@/lib/deck/ids", async () => {
  const f = await import("@/lib/deck/__tests__/fixtures");
  return { newId: f.stubNewId };
});

import { AUTOSAVE_MS, COALESCE_MS, HISTORY_CAP, SAVE_RETRY_MS, flushSave, useDeckStore } from "@/store/deck-store";
import {
  DECK_INDEX_KEY,
  IMPORT_MAX_BYTES,
  deckKey,
  deleteDeckById,
  exportDeckJson,
  importDeckJson,
  listDecks,
  loadDeckById,
  saveDeck,
  type DeckSummary,
} from "@/lib/persist";
import * as idb from "idb-keyval";
import { makeDeck, resetIds, text } from "@/lib/deck/__tests__/fixtures";

const store = () => useDeckStore.getState();

function slideIds(): string[] {
  return (store().deck as Deck).slides.map((s) => s.id);
}

beforeEach(() => {
  resetIds();
  memory.clear();
  vi.useFakeTimers();
  useDeckStore.setState({
    deck: null,
    selectedSlideId: null,
    selectedElementIds: [],
    past: [],
    future: [],
    editingElementId: null,
    zoom: "fit",
    dirty: false,
    saveError: null,
  });
});

afterEach(async () => {
  await flushSave();
  vi.useRealTimers();
});

describe("useDeckStore: load and commit", () => {
  it("loadDeck selects the first slide and resets history", () => {
    const deck = makeDeck(3);
    useDeckStore.setState({ past: [makeDeck(1)], future: [makeDeck(1)], dirty: true });
    store().loadDeck(deck);
    const s = store();
    expect(s.deck).toBe(deck);
    expect(s.selectedSlideId).toBe(deck.slides[0].id);
    expect(s.past).toEqual([]);
    expect(s.future).toEqual([]);
    expect(s.dirty).toBe(false);
  });

  it("commit clones, applies the mutator, pushes history and bumps updatedAt", () => {
    const deck = makeDeck(2);
    store().loadDeck(deck);
    store().commit((d) => {
      d.title = "Edited";
    });
    const s = store();
    expect(s.deck).not.toBe(deck);
    expect(s.deck?.title).toBe("Edited");
    expect(deck.title).toBe("Test deck");
    expect(s.past).toHaveLength(1);
    expect(s.past[0]).toBe(deck);
    expect(s.future).toEqual([]);
    expect(s.dirty).toBe(true);
    expect(s.deck?.updatedAt).not.toBe(deck.updatedAt);
  });

  it("commit without a deck is a no-op", () => {
    store().commit((d) => {
      d.title = "x";
    });
    expect(store().deck).toBeNull();
    expect(store().past).toEqual([]);
  });

  it("undo/redo round trip restores decks and clears redo on new commit", () => {
    store().loadDeck(makeDeck(2));
    store().setTitle("One");
    store().setTitle("Two");
    expect(store().deck?.title).toBe("Two");
    expect(store().past).toHaveLength(2);

    store().undo();
    expect(store().deck?.title).toBe("One");
    expect(store().past).toHaveLength(1);
    expect(store().future).toHaveLength(1);

    store().undo();
    expect(store().deck?.title).toBe("Test deck");
    expect(store().past).toHaveLength(0);
    expect(store().future).toHaveLength(2);

    store().undo(); // nothing left, no throw
    expect(store().deck?.title).toBe("Test deck");

    store().redo();
    expect(store().deck?.title).toBe("One");
    store().redo();
    expect(store().deck?.title).toBe("Two");
    expect(store().future).toHaveLength(0);
    store().redo(); // nothing left, no throw
    expect(store().deck?.title).toBe("Two");

    store().undo();
    store().setTitle("Branch");
    expect(store().deck?.title).toBe("Branch");
    expect(store().future).toEqual([]);
    expect(store().past.map((d) => d.title)).toEqual(["Test deck", "One"]);
  });

  it("caps history at 100 entries, dropping the oldest", () => {
    store().loadDeck(makeDeck(1));
    for (let i = 1; i <= HISTORY_CAP + 20; i += 1) store().setTitle(`t${i}`);
    const s = store();
    expect(s.past).toHaveLength(HISTORY_CAP);
    expect(s.past[0].title).toBe("t20");
    expect(s.past[s.past.length - 1].title).toBe(`t${HISTORY_CAP + 19}`);
    expect(s.deck?.title).toBe(`t${HISTORY_CAP + 20}`);
  });

  it("autosaves 800 ms after a commit and clears dirty", async () => {
    const deck = makeDeck(2);
    store().loadDeck(deck);
    store().setTitle("Saved?");
    expect(memory.has(deckKey(deck.id))).toBe(false);
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS - 1);
    expect(memory.has(deckKey(deck.id))).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const saved = memory.get(deckKey(deck.id)) as Deck;
    expect(saved.title).toBe("Saved?");
    expect(store().dirty).toBe(false);
    const index = memory.get(DECK_INDEX_KEY) as DeckSummary[];
    expect(index).toHaveLength(1);
    expect(index[0]).toMatchObject({ id: deck.id, title: "Saved?", slideCount: 2, themeId: "paper" });
  });

  it("debounces rapid commits into one save; flushSave writes immediately", async () => {
    const deck = makeDeck(1);
    store().loadDeck(deck);
    store().setTitle("a");
    await vi.advanceTimersByTimeAsync(500);
    store().setTitle("b");
    await vi.advanceTimersByTimeAsync(500);
    expect(memory.has(deckKey(deck.id))).toBe(false);
    await flushSave();
    expect((memory.get(deckKey(deck.id)) as Deck).title).toBe("b");
    expect(store().dirty).toBe(false);
  });

  it("undo also autosaves", async () => {
    const deck = makeDeck(1);
    store().loadDeck(deck);
    store().setTitle("a");
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS);
    store().undo();
    expect(store().dirty).toBe(true);
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS);
    expect((memory.get(deckKey(deck.id)) as Deck).title).toBe("Test deck");
    expect(store().dirty).toBe(false);
  });
});

describe("useDeckStore: selection", () => {
  it("selectSlide clears element selection and editing when the slide changes", () => {
    const deck = makeDeck(2);
    store().loadDeck(deck);
    const first = deck.slides[0];
    store().selectElements([first.elements[0].id]);
    store().setEditingElement(first.elements[0].id);
    store().selectSlide(first.id); // same slide: keep
    expect(store().selectedElementIds).toEqual([first.elements[0].id]);
    store().selectSlide(deck.slides[1].id);
    expect(store().selectedSlideId).toBe(deck.slides[1].id);
    expect(store().selectedElementIds).toEqual([]);
    expect(store().editingElementId).toBeNull();
  });

  it("deleting the selected slide moves selection to a neighbour", () => {
    const deck = makeDeck(3);
    store().loadDeck(deck);
    store().selectSlide(deck.slides[1].id);
    store().selectElements([deck.slides[1].elements[0].id]);
    store().deleteSlide(deck.slides[1].id);
    expect(slideIds()).toEqual([deck.slides[0].id, deck.slides[2].id]);
    expect(store().selectedSlideId).toBe(deck.slides[2].id);
    expect(store().selectedElementIds).toEqual([]);
  });

  it("undo after adding a slide drops the now-missing selection", () => {
    const deck = makeDeck(1);
    store().loadDeck(deck);
    store().addSlide(0);
    const added = store().selectedSlideId;
    expect(added).not.toBe(deck.slides[0].id);
    store().undo();
    expect(store().selectedSlideId).toBe(deck.slides[0].id);
  });
});

describe("useDeckStore: element actions", () => {
  it("updateElement patches fields without changing id/type", () => {
    const deck = makeDeck(1);
    store().loadDeck(deck);
    const el = deck.slides[0].elements[0];
    store().updateElement(deck.slides[0].id, el.id, { x: 10, y: 20, type: "image" } as unknown as Partial<TextElement>);
    const after = store().deck?.slides[0].elements[0];
    expect(after).toMatchObject({ id: el.id, type: "text", x: 10, y: 20 });
    expect(store().past).toHaveLength(1);
  });

  it("addElement puts the element on top and selects it", () => {
    const deck = makeDeck(1);
    store().loadDeck(deck);
    const el = text("Added", "body", 500, 0);
    store().addElement(deck.slides[0].id, el);
    const slide = store().deck?.slides[0];
    expect(slide?.elements.map((e) => e.id)).toContain(el.id);
    const added = slide?.elements.find((e) => e.id === el.id);
    expect(added?.z).toBeGreaterThan(Math.max(...deck.slides[0].elements.map((e) => e.z)));
    expect(store().selectedElementIds).toEqual([el.id]);
  });

  it("deleteElements removes them and prunes the selection", () => {
    const deck = makeDeck(2);
    store().loadDeck(deck);
    const slide = deck.slides[1];
    store().selectSlide(slide.id);
    const [a, b] = slide.elements;
    expect(b).toBeDefined();
    store().selectElements([a.id, b.id]);
    store().deleteElements(slide.id, [a.id]);
    expect(store().deck?.slides[1].elements.map((e) => e.id)).not.toContain(a.id);
    expect(store().selectedElementIds).toEqual([b.id]);
  });

  it("duplicateElements assigns new ids, offsets and selects the copies", () => {
    const deck = makeDeck(1);
    store().loadDeck(deck);
    const src = deck.slides[0].elements[0];
    store().duplicateElements(deck.slides[0].id, [src.id]);
    const slide = store().deck?.slides[0] as Deck["slides"][number];
    expect(slide.elements).toHaveLength(deck.slides[0].elements.length + 1);
    const copy = slide.elements[slide.elements.length - 1];
    expect(copy.id).not.toBe(src.id);
    expect(copy).toMatchObject({ type: "text", x: src.x + 24, y: src.y + 24 });
    expect(copy.z).toBeGreaterThan(Math.max(...deck.slides[0].elements.map((e) => e.z)));
    expect(store().selectedElementIds).toEqual([copy.id]);
    const ids = slide.elements.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("useDeckStore: slide and deck actions", () => {
  it("addSlide without a slide builds a title-bullets slide from the default content", () => {
    const deck = makeDeck(2);
    store().loadDeck(deck);
    store().addSlide(0);
    const slides = store().deck?.slides as Deck["slides"];
    expect(slides).toHaveLength(3);
    const added = slides[1];
    expect(added.layoutId).toBe("title-bullets");
    expect(added.content).toEqual({ kind: "bullets", title: "New slide", bullets: ["First point", "Second point"] });
    expect(store().selectedSlideId).toBe(added.id);
  });

  it("addSlide with a slide inserts it and clamps the index", () => {
    const deck = makeDeck(1);
    store().loadDeck(deck);
    const custom = makeDeck(1, "other").slides[0];
    store().addSlide(99, custom);
    expect(slideIds()[1]).toBe(custom.id);
  });

  it("duplicateSlide copies with fresh slide and element ids", () => {
    const deck = makeDeck(2);
    store().loadDeck(deck);
    store().duplicateSlide(deck.slides[0].id);
    const slides = store().deck?.slides as Deck["slides"];
    expect(slides).toHaveLength(3);
    const copy = slides[1];
    expect(copy.id).not.toBe(deck.slides[0].id);
    expect(copy.content).toEqual(deck.slides[0].content);
    const originalIds = new Set(deck.slides[0].elements.map((e) => e.id));
    for (const el of copy.elements) expect(originalIds.has(el.id)).toBe(false);
    expect(store().selectedSlideId).toBe(copy.id);
  });

  it("deleteSlide refuses to remove the last slide", () => {
    const deck = makeDeck(1);
    store().loadDeck(deck);
    store().deleteSlide(deck.slides[0].id);
    expect(store().deck?.slides).toHaveLength(1);
    expect(store().past).toHaveLength(0);
  });

  it("reorderSlides moves a slide and ignores bad indices", () => {
    const deck = makeDeck(3);
    store().loadDeck(deck);
    const ids = deck.slides.map((s) => s.id);
    store().reorderSlides(0, 2);
    expect(slideIds()).toEqual([ids[1], ids[2], ids[0]]);
    store().reorderSlides(5, 0);
    expect(slideIds()).toEqual([ids[1], ids[2], ids[0]]);
    expect(store().past).toHaveLength(1);
  });

  it("setTheme and setTitle are undoable commits", () => {
    store().loadDeck(makeDeck(1));
    store().setTheme("midnight");
    store().setTitle("Renamed");
    expect(store().deck).toMatchObject({ themeId: "midnight", title: "Renamed" });
    store().undo();
    store().undo();
    expect(store().deck).toMatchObject({ themeId: "paper", title: "Test deck" });
  });

  it("applyLayoutToSlide rebuilds from slide.content and clears element selection", () => {
    const deck = makeDeck(2);
    store().loadDeck(deck);
    store().selectElements([deck.slides[0].elements[0].id]);
    store().applyLayoutToSlide(deck.slides[0].id, "two-column");
    const slide = store().deck?.slides[0];
    expect(slide?.layoutId).toBe("two-column");
    expect(slide?.elements[0]).toMatchObject({ html: "Slide 1 [two-column]" });
    expect(store().selectedElementIds).toEqual([]);
  });

  it("applyLayoutToSlide without content keeps elements", () => {
    const deck = makeDeck(1);
    delete deck.slides[0].content;
    store().loadDeck(deck);
    const before = structuredClone(deck.slides[0].elements);
    store().applyLayoutToSlide(deck.slides[0].id, "blank");
    expect(store().deck?.slides[0].layoutId).toBe("blank");
    expect(store().deck?.slides[0].elements).toEqual(before);
  });

  it("applyPatch applies ops through applyOps inside one undoable commit", () => {
    const deck = makeDeck(2);
    store().loadDeck(deck);
    store().applyPatch([
      { op: "setTitle", title: "Patched" },
      { op: "insertSlide", atIndex: 1, content: { kind: "quote", title: "Q", quote: { text: "Hi" } } },
      { op: "setTheme", themeId: "sky-facet" },
    ]);
    expect(store().deck).toMatchObject({ title: "Patched", themeId: "sky-facet" });
    expect(store().deck?.slides).toHaveLength(3);
    expect(store().deck?.slides[1].layoutId).toBe("quote");
    expect(store().past).toHaveLength(1);
    store().undo();
    expect(store().deck?.slides).toHaveLength(2);
    expect(store().deck?.title).toBe("Test deck");
  });

  it("newBlankDeck creates a one-slide deck and schedules a save", async () => {
    const deck = store().newBlankDeck("midnight");
    expect(store().deck).toBe(deck);
    expect(deck.themeId).toBe("midnight");
    expect(deck.slides).toHaveLength(1);
    expect(deck.slides[0].layoutId).toBe("title-bullets");
    expect(deck.meta.source).toBe("blank");
    expect(store().selectedSlideId).toBe(deck.slides[0].id);
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS);
    expect(memory.has(deckKey(deck.id))).toBe(true);
  });
});

describe("persist", () => {
  it("saveDeck / loadDeckById round trip", async () => {
    const deck = makeDeck(2, "d1");
    await saveDeck(deck);
    const loaded = await loadDeckById("d1");
    expect(loaded).toEqual(deck);
    expect(await loadDeckById("nope")).toBeNull();
  });

  it("listDecks is sorted by updatedAt desc and deleteDeckById removes entries", async () => {
    const a = { ...makeDeck(1, "a"), updatedAt: "2026-01-01T00:00:00.000Z" };
    const b = { ...makeDeck(2, "b"), updatedAt: "2026-03-01T00:00:00.000Z" };
    const c = { ...makeDeck(3, "c"), updatedAt: "2026-02-01T00:00:00.000Z" };
    await saveDeck(a);
    await saveDeck(b);
    await saveDeck(c);
    expect((await listDecks()).map((d) => d.id)).toEqual(["b", "c", "a"]);

    await saveDeck({ ...a, updatedAt: "2026-04-01T00:00:00.000Z", title: "A2" });
    const list = await listDecks();
    expect(list.map((d) => d.id)).toEqual(["a", "b", "c"]);
    expect(list[0]).toMatchObject({ title: "A2", slideCount: 1, themeId: "paper" });
    expect(list).toHaveLength(3);

    await deleteDeckById("b");
    expect((await listDecks()).map((d) => d.id)).toEqual(["a", "c"]);
    expect(await loadDeckById("b")).toBeNull();
  });

  it("exportDeckJson produces a JSON blob that imports back", async () => {
    const deck = makeDeck(2, "exp");
    const blob = exportDeckJson(deck);
    expect(blob.type).toBe("application/json");
    const file = new File([await blob.text()], "deck.json", { type: "application/json" });
    const imported = await importDeckJson(file);
    expect(imported.id).toBe("exp");
    expect(imported.slides).toEqual(deck.slides);
  });

  it("importDeckJson rejects invalid JSON and invalid decks", async () => {
    await expect(importDeckJson(new File(["{not json"], "x.json"))).rejects.toThrow(/valid JSON/);
    await expect(importDeckJson(new File([JSON.stringify({ hello: "world" })], "x.json"))).rejects.toThrow(/not a Presenta deck/);
    const bad = { ...makeDeck(1), themeId: "neon" };
    await expect(importDeckJson(new File([JSON.stringify(bad)], "x.json"))).rejects.toThrow(/themeId/);
  });

  it("importDeckJson assigns a new id and timestamps when the id already exists", async () => {
    const deck = makeDeck(1, "dup");
    await saveDeck(deck);
    const imported = await importDeckJson(new File([JSON.stringify(deck)], "dup.json"));
    expect(imported.id).not.toBe("dup");
    expect(imported.createdAt).not.toBe(deck.createdAt);
    expect(imported.updatedAt).not.toBe(deck.updatedAt);
    expect(imported.meta.source).toBe("import");
    expect(imported.slides).toEqual(deck.slides);
  });
});

describe("useDeckStore: commit coalescing and no-op skipping", () => {
  it("merges commits with the same coalesce key inside the window into one undo step", () => {
    const deck = makeDeck(1);
    store().loadDeck(deck);
    const elId = deck.slides[0].elements[0].id;
    const move = (x: number) =>
      store().commit(
        (d) => {
          d.slides[0].elements[0].x = x;
        },
        "Transform",
        { coalesce: "transform" },
      );
    vi.setSystemTime(new Date("2026-10-14T10:00:00.000Z"));
    move(100);
    vi.setSystemTime(new Date("2026-10-14T10:00:00.100Z"));
    move(200);
    vi.setSystemTime(new Date("2026-10-14T10:00:00.300Z"));
    move(300);
    expect(store().past).toHaveLength(1);
    expect(store().deck?.slides[0].elements[0].x).toBe(300);
    store().undo();
    expect(store().deck?.slides[0].elements[0]).toMatchObject({ id: elId, x: 96 });
  });

  it("starts a new step after the window, for a different key, and after undo", () => {
    store().loadDeck(makeDeck(1));
    const nudge = (x: number, key = "nudge") =>
      store().commit(
        (d) => {
          d.slides[0].elements[0].x = x;
        },
        "Nudge",
        { coalesce: key },
      );
    vi.setSystemTime(new Date("2026-10-14T10:00:00.000Z"));
    nudge(1);
    vi.setSystemTime(new Date(`2026-10-14T10:00:00.${String(COALESCE_MS + 1).padStart(3, "0")}Z`));
    nudge(2);
    expect(store().past).toHaveLength(2);
    nudge(3, "transform");
    expect(store().past).toHaveLength(3);
    nudge(4, "transform");
    expect(store().past).toHaveLength(3);
    store().undo();
    expect(store().deck?.slides[0].elements[0].x).toBe(2);
    nudge(5, "transform");
    expect(store().past).toHaveLength(3);
    expect(store().future).toEqual([]);
    store().setTitle("plain");
    nudge(6, "transform");
    expect(store().past).toHaveLength(5);
  });

  it("records no history, no updatedAt bump and no save for a commit that changes nothing", async () => {
    const deck = makeDeck(1);
    store().loadDeck(deck);
    store().commit((d) => {
      d.title = d.title;
    });
    store().commit(() => false);
    store().commit((d) => {
      d.title = "x";
      return false;
    });
    expect(store().past).toEqual([]);
    expect(store().deck).toBe(deck);
    expect(store().dirty).toBe(false);
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS * 2);
    expect(memory.has(deckKey(deck.id))).toBe(false);
    store().applyPatch([{ op: "setTitle", title: deck.title }]);
    expect(store().past).toEqual([]);
  });
});

describe("useDeckStore: saveError", () => {
  it("retries a failed save once after SAVE_RETRY_MS and clears saveError on success", async () => {
    const deck = makeDeck(1);
    store().loadDeck(deck);
    useDeckStore.setState({ saveError: "old" });
    const setSpy = vi.mocked(idb.set);
    setSpy.mockRejectedValueOnce(new Error("QuotaExceededError"));
    store().setTitle("Retry me");
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS);
    expect(memory.has(deckKey(deck.id))).toBe(false);
    expect(store().saveError).toBe("old");
    await vi.advanceTimersByTimeAsync(SAVE_RETRY_MS);
    expect(memory.has(deckKey(deck.id))).toBe(true);
    expect(store().saveError).toBeNull();
    expect(store().dirty).toBe(false);
  });

  it("surfaces the error after the retry also fails, then clears it on the next good save", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const deck = makeDeck(1);
    store().loadDeck(deck);
    const setSpy = vi.mocked(idb.set);
    setSpy.mockRejectedValueOnce(new Error("Disk full")).mockRejectedValueOnce(new Error("Disk full"));
    store().setTitle("Fails");
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS + SAVE_RETRY_MS);
    expect(store().saveError).toBe("Disk full");
    expect(store().dirty).toBe(true);
    expect(errorSpy).toHaveBeenCalledTimes(1);

    store().setTitle("Works");
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS);
    expect(store().saveError).toBeNull();
    expect(store().dirty).toBe(false);
    errorSpy.mockRestore();
  });
});

describe("persist: hardening", () => {
  it("saveDeck and deleteDeckById update the index through idb-keyval update()", async () => {
    const updateSpy = vi.mocked(idb.update);
    updateSpy.mockClear();
    await saveDeck(makeDeck(1, "u1"));
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy.mock.calls[0][0]).toBe(DECK_INDEX_KEY);
    await deleteDeckById("u1");
    expect(updateSpy).toHaveBeenCalledTimes(2);
    expect(await listDecks()).toEqual([]);
  });

  it("importDeckJson refuses files over IMPORT_MAX_BYTES before reading them", async () => {
    const text = vi.fn(async () => JSON.stringify(makeDeck(1)));
    const huge = { size: IMPORT_MAX_BYTES + 1, text } as unknown as File;
    await expect(importDeckJson(huge)).rejects.toThrow(/import limit is 20 MB/);
    expect(text).not.toHaveBeenCalled();
  });

  it("importDeckJson enforces the import bounds", async () => {
    const deck = makeDeck(1);
    deck.slides[0].notes = "n".repeat(2001);
    await expect(importDeckJson(new File([JSON.stringify(deck)], "x.json"))).rejects.toThrow(/notes/);
    const many = { ...makeDeck(1), slides: Array.from({ length: 101 }, (_, i) => ({ ...makeDeck(1).slides[0], id: `s${i}` })) };
    await expect(importDeckJson(new File([JSON.stringify(many)], "x.json"))).rejects.toThrow(/at most 100 slides/);
  });

  it("importDeckJson re-ids duplicate slides and elements and sanitises text", async () => {
    const deck = makeDeck(2, "reid");
    deck.slides[1].id = deck.slides[0].id;
    deck.slides[1].elements[0].id = deck.slides[1].elements[1].id;
    deck.slides[0].elements[0] = { ...text('<p onclick="x()">Hi<img src=x onerror=alert(1)></p>', "title", 96, 0), id: "keep" };
    deck.slides[0].elements.push({
      id: "card",
      type: "card",
      variant: "surface",
      title: "<b>T</b>",
      body: "B<script>x()</script>",
      x: 0,
      y: 0,
      w: 10,
      h: 10,
      rotation: 0,
      z: 9,
      locked: false,
      opacity: 1,
    });
    const imported = await importDeckJson(new File([JSON.stringify(deck)], "reid.json"));
    expect(imported.slides[0].id).toBe(deck.slides[0].id);
    expect(imported.slides[1].id).not.toBe(deck.slides[0].id);
    const ids = imported.slides[1].elements.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(imported.slides[1].elements[0].id).toBe(deck.slides[1].elements[1].id);
    expect(imported.slides[1].elements[1].id).not.toBe(deck.slides[1].elements[1].id);
    const title = imported.slides[0].elements[0];
    expect(title.type === "text" && title.html).toBe("<p>Hi</p>");
    const card = imported.slides[0].elements.find((e) => e.id === "card");
    expect(card).toMatchObject({ title: "T", body: "B" });
  });

  it("importDeckJson rejects unsafe image sources and gradients", async () => {
    const deck = makeDeck(1);
    deck.slides[0].background = { kind: "gradient", css: "url(https://evil.example/x)" };
    await expect(importDeckJson(new File([JSON.stringify(deck)], "x.json"))).rejects.toThrow(/background/);
    const deck2 = makeDeck(1);
    deck2.meta.brand = { logoDataUrl: "javascript:alert(1)" };
    await expect(importDeckJson(new File([JSON.stringify(deck2)], "x.json"))).rejects.toThrow(/logoDataUrl/);
  });
});
