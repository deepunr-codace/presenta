"use client";

import type { ReactNode } from "react";
import { useDeckStore } from "@/store/deck-store";
import { AppShell } from "@/components/shell/AppShell";

type Props = {
  id: string;
  children: ReactNode;
  /** The breadcrumb line; the editor leaves it out so its own tool bar is the only bar. */
  crumbs?: boolean;
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
export function DeckShell({ id, children, crumbs = true }: Props) {
  const title = useDeckStore((s) => (s.deck?.id === id ? s.deck.title : null));
  return (
    <AppShell
      active="decks"
      sidebar="full"
      sidebarStartCollapsed
      className="ps-deck-shell"
      breadcrumbs={crumbs ? [...CRUMBS, { label: title || "Deck" }] : undefined}
    >
      {children}
    </AppShell>
  );
}
