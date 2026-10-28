"use client";

import type { ReactNode } from "react";
import { useDeckStore } from "@/store/deck-store";
import { AppShell } from "@/components/shell/AppShell";

type Props = {
  id: string;
  children: ReactNode;
};

const CRUMBS = [
  { label: "Studio", href: "/" },
  { label: "Decks", href: "/decks" },
];

/**
 * App shell for the editor and review pages: breadcrumbs Studio / Decks / deck title. The page actions
 * (Export, Edit, Present) live in the editor tool row and the review title row per DESIGN.md §6, so they
 * are not passed to the shell as well.
 */
export function DeckShell({ id, children }: Props) {
  const title = useDeckStore((s) => (s.deck?.id === id ? s.deck.title : null));
  return (
    <AppShell active="decks" breadcrumbs={[...CRUMBS, { label: title || "Deck" }]}>
      {children}
    </AppShell>
  );
}
