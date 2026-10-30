/** File-name / URL stem from a deck title ("Q3 review" → "q3-review"). */
export function titleSlug(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "deck";
}

/**
 * Stable, friendly URL slug for a deck: the title slug plus a short suffix taken from its id
 * ("Q3 investor update", "deck_BiF7l-PTUZ") → "q3-investor-update-bif7lp". Generated once when the
 * deck is first saved and kept for the deck's lifetime, so renaming the deck never breaks its link.
 */
export function deckUrlSlug(title: string, id: string): string {
  const suffix = id
    .replace(/^deck_/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(-6);
  return `${titleSlug(title)}-${suffix || "deck"}`;
}
