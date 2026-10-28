"use client";

import Link from "next/link";
import { Presentation, ShareNetwork, UsersThree } from "@phosphor-icons/react";
import type { SharedDeck } from "@/lib/collab";
import { timeAgo } from "@/lib/time";

type Props = {
  deck: SharedDeck;
  /** Team id to name, so the card can say which team gave access. */
  teamNames?: Map<string, string>;
};

/** Card for a deck someone else shared with me: who owns it, what I can do with it, and Open / Edit. */
export function SharedDeckCard({ deck: d, teamNames }: Props) {
  const via = d.teamIds.map((id) => teamNames?.get(id) ?? "a team");
  return (
    <li className="ps-glass flex flex-col gap-2 p-4">
      <span className="flex flex-wrap items-center gap-2 text-[var(--ps-smoke)]">
        <Presentation size={16} weight="light" aria-hidden />
        <span className="ps-pill">{d.role === "editor" ? "Can edit" : "Can view"}</span>
        {via.length ? (
          <span className="ps-pill" title={`Shared through ${via.join(", ")}`}>
            <UsersThree size={12} /> {via[0]}
            {via.length > 1 ? ` +${via.length - 1}` : ""}
          </span>
        ) : null}
      </span>
      <h3 className="ps-cardtitle truncate" title={d.title || "Untitled deck"}>
        {d.title || "Untitled deck"}
      </h3>
      <p className="ps-cardcaption flex items-center gap-1.5">
        <ShareNetwork size={12} aria-hidden /> {d.ownerName} · {d.slideCount} {d.slideCount === 1 ? "slide" : "slides"} · {timeAgo(d.updatedAt)}
      </p>
      <div className="mt-1 flex gap-2">
        <Link href={`/deck/${encodeURIComponent(d.id)}`} className="ps-btn ps-btn-xs">
          Open
        </Link>
        {d.role === "editor" ? (
          <Link href={`/edit/${encodeURIComponent(d.id)}`} className="ps-btn ps-btn-primary ps-btn-xs">
            Edit
          </Link>
        ) : null}
      </div>
    </li>
  );
}
