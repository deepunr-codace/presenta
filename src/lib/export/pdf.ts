/** Opens the print route in a new tab; `?auto=1` triggers the print dialog once fonts and images have loaded. */
export function openPrintView(deckId: string): void {
  if (typeof window === "undefined") return;
  window.open(`/print/${encodeURIComponent(deckId)}?auto=1`, "_blank", "noopener");
}
