"use client";

import { useEffect, useState } from "react";
import { listDecks, type DeckSummary } from "@/lib/persist";

/** Saved decks from the signed-in account, newest first; `null` until the server has answered. */
export function useDecks(): DeckSummary[] | null {
  const [decks, setDecks] = useState<DeckSummary[] | null>(null);
  useEffect(() => {
    let alive = true;
    listDecks()
      .then((list) => alive && setDecks(list))
      .catch(() => alive && setDecks([]));
    return () => {
      alive = false;
    };
  }, []);
  return decks;
}
