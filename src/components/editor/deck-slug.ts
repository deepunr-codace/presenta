/** File-name stem from a deck title ("Q3 review" → "q3-review"). */
export function deckSlug(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "deck";
}
