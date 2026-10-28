"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { UsersThree } from "@phosphor-icons/react";
import { fetchTeams, type InviteInfo, type TeamSummary } from "@/lib/collab";

/** The teams I am in and any invitations waiting for me, with a way into the Teams page. */
export function TeamsCard() {
  const [data, setData] = useState<{ teams: TeamSummary[]; invites: InviteInfo[] } | null>(null);

  useEffect(() => {
    let alive = true;
    fetchTeams()
      .then((d) => alive && setData(d))
      .catch(() => alive && setData({ teams: [], invites: [] }));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className="ps-glass h-full" data-paper aria-labelledby="teams-title">
      <div className="flex items-center gap-2">
        <UsersThree size={20} weight="light" aria-hidden />
        <h2 id="teams-title" className="ps-cardtitle">
          Teams
        </h2>
        {data?.invites.length ? <span className="ps-pill ml-auto">{data.invites.length} invitation{data.invites.length === 1 ? "" : "s"}</span> : null}
      </div>
      {!data ? <div className="mt-4 h-12 animate-pulse rounded-[var(--ps-r-md)] bg-[var(--ps-plate)]" aria-hidden /> : null}
      {data && data.teams.length === 0 ? <p className="ps-body mt-3">You are not in a team yet. Teams let you share decks with a whole group at once.</p> : null}
      {data?.teams.length ? (
        <ul className="mt-3 flex flex-col gap-1.5">
          {data.teams.slice(0, 4).map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 text-[14px]">
              <span className="truncate">{t.name}</span>
              <span className="ps-caption shrink-0">
                {t.memberCount} {t.memberCount === 1 ? "member" : "members"}
                {t.role === "owner" ? " · owner" : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <Link href="/teams" className="ps-btn ps-btn-xs mt-4 inline-flex">
        Manage teams
      </Link>
    </section>
  );
}
