"use client";

import { useEffect, useState } from "react";
import type { Deck } from "@/lib/deck/schema";
import { loadDeckById } from "@/lib/persist";

export type DeckLoadStatus = "loading" | "ready" | "missing";

type Loaded = { id: string; deck: Deck | null; status: DeckLoadStatus };

/** Loads a saved deck by id for the review, present and print routes. */
export function useDeck(id: string): { deck: Deck | null; status: DeckLoadStatus } {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadDeckById(id)
      .then((deck) => {
        if (!cancelled) setLoaded({ id, deck, status: deck ? "ready" : "missing" });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ id, deck: null, status: "missing" });
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // A result for a different id is stale; report loading until the effect replaces it.
  if (!loaded || loaded.id !== id) return { deck: null, status: "loading" };
  return { deck: loaded.deck, status: loaded.status };
}
