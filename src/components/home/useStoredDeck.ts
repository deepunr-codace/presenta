"use client";

import { useEffect, useState } from "react";
import type { Deck } from "@/lib/deck/schema";
import { loadDeckById } from "@/lib/persist";

/** Full deck for a summary card: undefined while loading, null when it could not be read. */
export function useStoredDeck(id: string): Deck | null | undefined {
  const [deck, setDeck] = useState<Deck | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    void loadDeckById(id)
      .then((d) => {
        if (alive) setDeck(d);
      })
      .catch(() => {
        if (alive) setDeck(null);
      });
    return () => {
      alive = false;
    };
  }, [id]);
  return deck;
}
