/**
 * Shared class lists for app chrome (not for slides; slides use theme tokens).
 * Colours come from the `--ps-*` tokens in globals.css (see DESIGN.md §5).
 */

/** Filled pill: ink fill, canvas text, 36 px. Pair with a height class such as `h-9 px-4`. */
export const PRIMARY_BTN =
  "rounded-[var(--ps-r-pill)] border border-[var(--ps-ink)] bg-[var(--ps-ink)] text-[14px] font-medium tracking-normal text-[var(--ps-on-ink)] hover:border-[var(--ps-graphite)] hover:bg-[var(--ps-graphite)] focus-visible:border-[var(--ps-ink)] focus-visible:ring-[var(--ps-ink-ring)] disabled:opacity-35 disabled:pointer-events-none";

/** Outline pill: canvas fill, ink text, 1 px line-2 border. */
export const SECONDARY_BTN =
  "rounded-[var(--ps-r-pill)] border border-[var(--ps-line-2)] bg-[var(--ps-canvas)] text-[14px] font-medium tracking-normal text-[var(--ps-ink)] hover:border-[var(--ps-ash)] hover:bg-[var(--ps-plate)] hover:text-[var(--ps-ink)] aria-expanded:bg-[var(--ps-plate)] focus-visible:ring-[var(--ps-ink-ring)] dark:border-[var(--ps-line-2)] dark:bg-[var(--ps-canvas)] dark:hover:bg-[var(--ps-plate)]";

/** Ghost pill: transparent until hover (plate). */
export const GHOST_BTN = "rounded-[var(--ps-r-pill)] text-[14px] font-medium tracking-normal text-[var(--ps-smoke)] hover:bg-[var(--ps-plate)] hover:text-[var(--ps-ink)] focus-visible:ring-[var(--ps-ink-ring)] dark:hover:bg-[var(--ps-plate)]";

/** Field surface for shadcn Input, Textarea and SelectTrigger: paper fill, 1 px line-2, 4 px radius, 14 px; ink border and ring on focus. */
export const FIELD =
  "rounded-[var(--ps-r-input)] border-[var(--ps-line-2)] bg-[var(--ps-paper)] px-3 text-[14px] tracking-normal text-[var(--ps-ink)] shadow-none hover:border-[var(--ps-ash)] focus-visible:border-[var(--ps-ink)] focus-visible:ring-2 focus-visible:ring-[var(--ps-ink-ring)] dark:bg-[var(--ps-paper)]";
