import type { Deck } from "@/lib/deck/schema";
import { getTheme, resolveTheme } from "@/lib/deck/themes";
import type { DeckSummary } from "@/lib/persist";
import { timeAgo } from "@/lib/time";

type Props = {
  summary: DeckSummary;
  deck: Deck | null | undefined;
};

/** Theme dot, theme name, slide count and age for a deck card. */
export function DeckMeta({ summary, deck }: Props) {
  // Brand overrides live on the full deck; the index only knows the theme id.
  const theme = deck ? resolveTheme(deck) : getTheme(summary.themeId);
  return (
    <p className="ps-cardcaption flex items-center gap-1.5">
      <span className="inline-block size-2.5 shrink-0 rounded-full ring-1 ring-[var(--ps-line-2)]" style={{ background: `linear-gradient(135deg, ${theme.swatch[0]} 50%, ${theme.swatch[1]} 50%)` }} aria-hidden />
      <span className="truncate">
        {theme.name} · {summary.slideCount} slide{summary.slideCount === 1 ? "" : "s"} · {timeAgo(summary.updatedAt)}
      </span>
    </p>
  );
}
