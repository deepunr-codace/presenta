import { create } from "zustand";
import type { Deck } from "@/lib/deck/schema";

/** Where the editor canvas was on screen when the deck was minimized, in viewport pixels. */
export type MiniDeckRect = { left: number; top: number; width: number; height: number };

export type MiniDeckItem = {
  /** The deck as it was when the user left the editor. */
  deck: Deck;
  /** The slide that was on stage, if any (the first slide is the fallback). */
  slideId: string | null;
  /** The canvas rect, so the card can fly out of it. Null when the source is unknown (back button). */
  from: MiniDeckRect | null;
};

type MiniDeckState = {
  mini: MiniDeckItem | null;
  /** Keep an open deck in the corner player. */
  minimize: (deck: Deck, slideId: string | null, from: MiniDeckRect | null) => void;
  /** Close the corner player. */
  dismiss: () => void;
};

/**
 * A deck the user was editing, shown as a small corner player after they leave the editor (like a
 * video mini player). Lives in a global store because the editor unmounts on navigation.
 */
export const useMiniDeck = create<MiniDeckState>()((set) => ({
  mini: null,
  minimize: (deck, slideId, from) => set({ mini: { deck, slideId, from } }),
  dismiss: () => set({ mini: null }),
}));
