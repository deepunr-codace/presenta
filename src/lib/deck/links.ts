/** The URL segment to use for a deck: its friendly slug when known, otherwise its raw id. */
export function deckSegment(id: string, slug?: string | null): string {
  return slug || id;
}
