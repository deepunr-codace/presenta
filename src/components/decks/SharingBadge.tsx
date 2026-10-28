import { LinkSimple, Lock, UsersThree } from "@phosphor-icons/react";
import type { DeckSummary } from "@/lib/persist";

type Props = {
  sharing: DeckSummary["sharing"];
  /** Team id to name, so the tooltip can say which teams. */
  teamNames: Map<string, string>;
};

/**
 * Google-Drive-style sharing indicator for one of my decks: a lock when it is only mine, a people icon with a count
 * when it is shared, a link icon when anyone with the link can view. The tooltip says exactly who.
 */
export function SharingBadge({ sharing, teamNames }: Props) {
  if (!sharing) return null;
  const teams = sharing.teamIds.map((id) => teamNames.get(id)).filter((n): n is string => Boolean(n));
  const count = sharing.people + sharing.teamIds.length;
  const linkOn = sharing.link === "anyone_view";

  const who: string[] = [];
  if (sharing.names.length) who.push(sharing.names.join(", ") + (sharing.people > sharing.names.length ? ` and ${sharing.people - sharing.names.length} more` : ""));
  if (teams.length) who.push(`team ${teams.join(", ")}`);
  if (linkOn) who.push(sharing.linkViewers ? `anyone with the link (${sharing.linkViewers} opened it)` : "anyone with the link can view");
  const title = who.length ? `Shared with ${who.join("; ")}` : "Only you can see this deck";

  return (
    <span className="inline-flex flex-wrap items-center gap-1" title={title}>
      {count > 0 ? (
        <span className="ps-pill" aria-label={title}>
          <UsersThree size={12} /> Shared · {count}
        </span>
      ) : null}
      {linkOn ? (
        <span className="ps-pill" aria-label="Anyone with the link can view">
          <LinkSimple size={12} /> Link on
        </span>
      ) : null}
      {count === 0 && !linkOn ? (
        <span className="ps-pill" aria-label="Only you can see this deck">
          <Lock size={12} /> Only you
        </span>
      ) : null}
    </span>
  );
}
