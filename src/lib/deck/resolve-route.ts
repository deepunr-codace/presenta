import { findDeckLocation } from "@/lib/decks-db";

/**
 * A deck page's URL segment may be the deck's real id (old links, direct API use) or its friendly
 * slug. Resolve it to the real id the rest of the app works with; if nothing matches, return the
 * segment unchanged so the page's existing "deck not found" handling still runs.
 */
export async function resolveDeckRouteId(idOrSlug: string): Promise<string> {
  const location = await findDeckLocation(idOrSlug);
  return location?.id ?? idOrSlug;
}
