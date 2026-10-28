import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { makeDeck } from "@/lib/deck/__tests__/fixtures";
import { emptyTrash, listDecks, listTrash, loadDeckById, purgeDeck, restoreDeck, saveDeck, trashDeck } from "../persist";
import { installFakeServer } from "./fake-server";

const server = installFakeServer();

beforeEach(() => server.reset());
afterAll(() => vi.unstubAllGlobals());

describe("trash", () => {
  it("moves a deck out of the list and into the trash, keeping its data", async () => {
    const deck = makeDeck(2);
    await saveDeck(deck);
    expect(await trashDeck(deck.id)).toBe(true);
    expect(await listDecks()).toEqual([]);
    const trash = await listTrash();
    expect(trash.map((d) => d.id)).toEqual([deck.id]);
    expect(trash[0].trashedAt).toBeTruthy();
    expect(await loadDeckById(deck.id)).not.toBeNull();
  });

  it("restores a trashed deck to the list", async () => {
    const deck = makeDeck(1);
    await saveDeck(deck);
    await trashDeck(deck.id);
    expect(await restoreDeck(deck.id)).toBe(true);
    expect((await listDecks()).map((d) => d.id)).toEqual([deck.id]);
    expect(await listTrash()).toEqual([]);
  });

  it("returns false for unknown ids", async () => {
    expect(await trashDeck("nope")).toBe(false);
    expect(await restoreDeck("nope")).toBe(false);
  });

  it("keeps a deck in the trash when it is saved again", async () => {
    const deck = makeDeck(1);
    await saveDeck(deck);
    await trashDeck(deck.id);
    await saveDeck({ ...deck, title: "Edited while trashed" });
    expect(await listDecks()).toEqual([]);
    expect((await listTrash()).map((d) => d.id)).toEqual([deck.id]);
  });

  it("purges one deck or the whole trash, removing the data", async () => {
    const a = makeDeck(1);
    const b = { ...makeDeck(1), id: "deck-b" };
    await saveDeck(a);
    await saveDeck(b);
    await trashDeck(a.id);
    await trashDeck(b.id);
    await purgeDeck(a.id);
    expect(await loadDeckById(a.id)).toBeNull();
    expect((await listTrash()).map((d) => d.id)).toEqual([b.id]);
    await emptyTrash();
    expect(await listTrash()).toEqual([]);
    expect(await loadDeckById(b.id)).toBeNull();
  });

  it("surfaces a server error instead of pretending the deck was trashed", async () => {
    const deck = makeDeck(1);
    await saveDeck(deck);
    server.failNext(1, "Could not update that deck.");
    await expect(trashDeck(deck.id)).rejects.toThrow("Could not update that deck.");
    expect((await listDecks()).map((d) => d.id)).toEqual([deck.id]);
  });
});
