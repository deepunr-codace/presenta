"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { ChatCircleDots, Minus, UsersThree, X } from "@phosphor-icons/react";
import type { TeamSummary } from "@/lib/collab";
import { TeamChat } from "./TeamChat";

type MessengerApi = { openChat: (team: TeamSummary) => void };
const MessengerContext = createContext<MessengerApi | null>(null);

export function TeamMessengerProvider({ children }: { children: ReactNode }) {
  const [team, setTeam] = useState<TeamSummary | null>(null);
  const [minimized, setMinimized] = useState(false);
  const openChat = useCallback((next: TeamSummary) => { setTeam(next); setMinimized(false); }, []);
  const api = useMemo(() => ({ openChat }), [openChat]);

  return <MessengerContext.Provider value={api}>
    {children}
    {team ? <aside className="ps-team-messenger" data-minimized={minimized ? "true" : undefined} aria-label={`${team.name} messenger`}>
      {minimized ? <button type="button" className="ps-team-messenger-launcher" onClick={() => setMinimized(false)}><span className="ps-messenger-avatar"><UsersThree size={16} /></span><span>{team.name}</span><ChatCircleDots size={15} /></button> : <>
        <header className="ps-team-messenger-head"><span className="ps-messenger-avatar"><UsersThree size={16} /></span><span className="ps-messenger-heading"><strong>{team.name}</strong><small>Team chat · updates live</small></span><button type="button" className="ps-iconbtn ps-iconbtn-sm" aria-label="Minimize chat" onClick={() => setMinimized(true)}><Minus size={14} /></button><button type="button" className="ps-iconbtn ps-iconbtn-sm" aria-label="Close chat" onClick={() => setTeam(null)}><X size={14} /></button></header>
        <TeamChat key={team.id} teamId={team.id} />
      </>}
    </aside> : null}
  </MessengerContext.Provider>;
}

export function useTeamMessenger() {
  const context = useContext(MessengerContext);
  if (!context) throw new Error("useTeamMessenger must be used inside <TeamMessengerProvider>");
  return context;
}
