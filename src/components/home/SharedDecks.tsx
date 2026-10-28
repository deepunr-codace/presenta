"use client";

import { useEffect, useState } from "react";
import { fetchSharedDecks, type SharedDeck } from "@/lib/collab";
import { SectionTitle } from "@/components/ui-kit/SectionTitle";
import { SharedDeckCard } from "./SharedDeckCard";

/** "Shared with me" on Home: decks other people or my teams have given me access to. Hidden when there are none. */
export function SharedDecks() {
  const [decks, setDecks] = useState<SharedDeck[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetchSharedDecks()
      .then((d) => alive && setDecks(d))
      .catch(() => alive && setDecks([]));
    return () => {
      alive = false;
    };
  }, []);

  if (!decks?.length) return <span id="shared" />;

  return (
    <section id="shared" className="mt-12 scroll-mt-6" aria-labelledby="shared-decks-title">
      <SectionTitle title={<span id="shared-decks-title">Shared with me</span>} caption={`${decks.length} deck${decks.length === 1 ? "" : "s"} from other people and teams`} className="mb-5" />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-label="Shared decks">
        {decks.map((d) => (
          <SharedDeckCard key={d.id} deck={d} />
        ))}
      </ul>
    </section>
  );
}
