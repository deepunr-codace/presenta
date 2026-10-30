"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ChatCircleDots, Copy, Crown, Plus, SignOut, Trash, UsersThree, X } from "@phosphor-icons/react";
import {
  acceptInvite,
  createTeam,
  declineInvite,
  deleteTeam,
  fetchTeam,
  fetchTeams,
  inviteToTeam,
  inviteUrl,
  leaveTeam,
  removeMember,
  revokeInvite,
  type InviteInfo,
  type TeamDetail,
  type TeamSummary,
} from "@/lib/collab";
import { AppShell } from "@/components/shell/AppShell";
import { useToast } from "@/components/shell/Toast";
import { ErrorNotice } from "@/components/ui-kit/ErrorNotice";
import { useTeamMessenger } from "./TeamMessengerProvider";

/** /teams: the teams I belong to, invitations waiting for me, and (for owners) members and invitations. */
export function TeamsScreen() {
  const { toast } = useToast();
  const { openChat } = useTeamMessenger();
  const router = useRouter();
  const [teams, setTeams] = useState<TeamSummary[] | null>(null);
  const [invites, setInvites] = useState<InviteInfo[]>([]);
  const [open, setOpen] = useState<TeamDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const handledQuery = useRef(false);

  /** My teams and invitations, plus the detail of one team when asked. Throws on failure. */
  const fetchAll = useCallback(async (openId?: string) => {
    const r = await fetchTeams();
    return { teams: r.teams, invites: r.invites, team: openId ? await fetchTeam(openId) : undefined };
  }, []);

  const apply = useCallback((d: { teams: TeamSummary[]; invites: InviteInfo[]; team?: TeamDetail }) => {
    setTeams(d.teams);
    setInvites(d.invites);
    if (d.team) setOpen(d.team);
    setError(null);
  }, []);

  const fail = useCallback((err: unknown) => {
    setError(err instanceof Error ? err.message : "Could not load your teams.");
    setTeams((t) => t ?? []);
  }, []);

  const load = useCallback((openId?: string) => fetchAll(openId).then(apply).catch(fail), [fetchAll, apply, fail]);

  useEffect(() => {
    let alive = true;
    fetchAll()
      .then((d) => alive && apply(d))
      .catch((err: unknown) => alive && fail(err));
    return () => {
      alive = false;
    };
  }, [fetchAll, apply, fail]);

  useEffect(() => {
    if (!teams || handledQuery.current) return;
    const params = new URLSearchParams(window.location.search);
    const requestedId = params.get("team");
    if (!requestedId) {
      handledQuery.current = true;
      return;
    }
    const summary = teams.find((team) => team.id === requestedId);
    if (!summary) return;
    handledQuery.current = true;
    if (params.get("chat") === "1") openChat(summary);
    fetchTeam(requestedId).then(setOpen).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not open the team."));
  }, [teams, openChat]);

  const act = async (fn: () => Promise<unknown>, done?: string, reopen?: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      if (done) toast(done, { tone: "success" });
      await load(reopen);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const openTeam = async (id: string) => {
    try {
      setOpen(await fetchTeam(id));
      setConfirm(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open the team.");
    }
  };

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await act(async () => {
      const { id } = await createTeam(name.trim());
      setName("");
      setOpen(await fetchTeam(id));
    }, "Team created.");
  };

  const onInvite = async (e: FormEvent) => {
    e.preventDefault();
    if (!open || !email.trim()) return;
    const teamId = open.id;
    await act(async () => {
      const { token } = await inviteToTeam(teamId, email.trim());
      setEmail("");
      try {
        await navigator.clipboard.writeText(inviteUrl(token));
        toast("Invitation created. The link is copied: send it to them.", { tone: "success" });
      } catch {
        toast("Invitation created.", { tone: "success" });
      }
    }, undefined, teamId);
  };

  const copyInvite = async (token: string) => {
    try {
      await navigator.clipboard.writeText(inviteUrl(token));
      toast("Invitation link copied.", { tone: "success" });
    } catch {
      toast("Could not copy the link.", { tone: "error" });
    }
  };

  const isOwner = open?.role === "owner";

  return (
    <AppShell active="teams" breadcrumbs={[{ label: "Studio", href: "/" }, { label: "Teams" }]}>
      <div className="ps-page">
        <div className="w-full max-w-[1180px]">
        <header className="ps-page-hero mb-8">
          <h1 className="ps-heading">Teams</h1>
          <p className="ps-body-lg mt-2">Put people together once, then share decks with the whole team. Invitations are links you send yourself; no email is sent.</p>
        </header>

        {error ? <ErrorNotice compact className="mb-4" message={error} /> : null}

        {invites.length ? (
          <section id="invitations" className="ps-glass mb-4" data-paper aria-label="Invitations">
            <h2 className="ps-cardtitle mb-3">Invitations for you</h2>
            <ul className="flex flex-col gap-2">
              {invites.map((i) => (
                <li key={i.token} className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 text-[13px]">
                    <strong>{i.invitedBy}</strong> invited you to join <strong>{i.teamName}</strong>
                  </span>
                  <button type="button" className="ps-btn ps-btn-xs" disabled={busy} onClick={() => void act(() => declineInvite(i.token), "Invitation declined.")}>
                    Decline
                  </button>
                  <button type="button" className="ps-btn ps-btn-primary ps-btn-xs" disabled={busy} onClick={() => void act(async () => void (await acceptInvite(i.token)), "You joined the team.")}>
                    Join
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section id="your-teams" className="ps-teams-section" aria-label="Your teams">
          <div className="ps-teams-section-head">
            <div><p className="ps-eyebrow">YOUR WORKSPACES</p><h2 className="ps-cardtitle">Your teams <span>{teams?.length ?? "—"}</span></h2></div>
            <p className="ps-caption">Choose a team to manage members, or jump into its live chat.</p>
          </div>
          {teams === null ? <div className="ps-team-grid"><div className="ps-team-card ps-team-skeleton" /><div className="ps-team-card ps-team-skeleton" /></div> : null}
          {teams?.length ? <ul className="ps-team-grid">
            {teams.map((team, index) => (
              <li key={team.id}>
                <article className="ps-team-card" data-tone={index % 4} data-selected={open?.id === team.id ? "true" : undefined}>
                  <button type="button" className="ps-team-card-main" aria-label={`Manage ${team.name}`} onClick={() => void openTeam(team.id)}>
                    <span className="ps-team-card-mark"><UsersThree size={19} weight="duotone" /></span>
                    <span className="ps-team-card-title"><span>{team.role === "owner" ? "YOUR TEAM" : "SHARED WITH YOU"}</span><strong>{team.name}</strong></span>
                    <ArrowRight size={16} className="ps-team-card-arrow" />
                  </button>
                  <div className="ps-team-card-meta"><span>{team.memberCount} {team.memberCount === 1 ? "member" : "members"}</span>{team.role === "owner" ? <span><Crown size={12} /> Owner</span> : <span>Member</span>}</div>
                  <div className="ps-team-card-actions">
                    <button type="button" onClick={() => openChat(team)}><ChatCircleDots size={14} /> Open chat</button>
                    <button type="button" onClick={() => void openTeam(team.id)}>Manage team <ArrowRight size={13} /></button>
                  </div>
                </article>
              </li>
            ))}
          </ul> : null}
          {teams?.length === 0 ? <div className="ps-team-empty"><span><UsersThree size={22} /></span><strong>Your team space starts here</strong><p>Create a team to share decks and keep conversations together.</p></div> : null}
          <form className="ps-team-create" onSubmit={onCreate}>
            <div><strong>Create a team</strong><span>Bring your collaborators into one space.</span></div>
            <div className="ps-team-create-fields"><input className="ps-input min-w-0 flex-1" placeholder="Give your team a name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} aria-label="New team name" /><button type="submit" className="ps-btn ps-btn-primary ps-btn-xs" disabled={busy || !name.trim()}><Plus size={13} /> Create team</button></div>
          </form>
        </section>

        <div className="mt-5 flex flex-col gap-4">

          {open ? (
            <section className="ps-glass" data-paper aria-label={`${open.name} team`}>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="ps-cardtitle">{open.name}</h2>
                <span className="ps-pill">{isOwner ? "You own this team" : `Owned by ${open.ownerName}`}</span>
                <button type="button" className="ps-btn ps-btn-xs ml-auto" onClick={() => openChat(open)}><ChatCircleDots size={13} /> Open chat</button>
                <button type="button" className="ps-iconbtn" aria-label="Close team" onClick={() => setOpen(null)}>
                  <X size={14} />
                </button>
              </div>

              <>
                  <h3 className="ps-label mb-2 mt-4">Members</h3>
                  <ul className="flex flex-col gap-2">
                    {open.members.map((m) => (
                      <li key={m.userId} className="flex items-center gap-2">
                        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--ps-plate)] text-[var(--ps-smoke)]" aria-hidden>
                          {((m.name || m.email)[0] ?? "?").toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px]">{m.name || m.email}</span>
                          <span className="ps-caption block truncate">{m.name ? m.email : ""}</span>
                        </span>
                        {m.role === "owner" ? <span className="ps-pill">Owner</span> : null}
                        {isOwner && m.role !== "owner" ? (
                          <button type="button" className="ps-iconbtn" aria-label={`Remove ${m.name || m.email}`} title="Remove from team" disabled={busy} onClick={() => void act(() => removeMember(open.id, m.userId), "Member removed.", open.id)}>
                            <X size={14} />
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>

                  {isOwner ? (
                    <>
                      <h3 className="ps-label mb-2 mt-5">Invite someone</h3>
                      <form className="flex gap-2" onSubmit={onInvite}>
                        <input className="ps-input min-w-0 flex-1" type="email" placeholder="Their email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email to invite" />
                        <button type="submit" className="ps-btn ps-btn-primary ps-btn-xs" disabled={busy || !email.trim()}>
                          Invite
                        </button>
                      </form>
                      <p className="ps-caption mt-1">They join after signing in with that email. Send them the invitation link.</p>
                      {open.invites.length ? (
                        <ul className="mt-3 flex flex-col gap-2">
                          {open.invites.map((i) => (
                            <li key={i.token} className="flex items-center gap-2">
                              <span className="min-w-0 flex-1 truncate text-[13px]">{i.email}</span>
                              <span className="ps-pill">Pending</span>
                              <button type="button" className="ps-btn ps-btn-xs" onClick={() => void copyInvite(i.token)}>
                                <Copy size={12} /> Copy link
                              </button>
                              <button type="button" className="ps-iconbtn" aria-label={`Cancel invitation for ${i.email}`} disabled={busy} onClick={() => void act(() => revokeInvite(open.id, i.token), "Invitation cancelled.", open.id)}>
                                <X size={14} />
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </>
                  ) : null}
              </>

              <div className="mt-6 flex flex-wrap gap-2 border-t border-[var(--ps-line)] pt-4">
                {isOwner ? (
                  confirm === open.id ? (
                    <button
                      type="button"
                      className="ps-btn ps-btn-xs"
                      data-danger="true"
                      disabled={busy}
                      onClick={() =>
                        void act(async () => {
                          await deleteTeam(open.id);
                          setOpen(null);
                        }, "Team deleted.")
                      }
                    >
                      <Trash size={12} /> Confirm: delete team and its shares
                    </button>
                  ) : (
                    <button type="button" className="ps-btn ps-btn-xs" onClick={() => setConfirm(open.id)}>
                      <Trash size={12} /> Delete team
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    className="ps-btn ps-btn-xs"
                    disabled={busy}
                    onClick={() =>
                      void act(async () => {
                        await leaveTeam(open.id);
                        setOpen(null);
                      }, "You left the team.")
                    }
                  >
                    <SignOut size={12} /> Leave team
                  </button>
                )}
              </div>
              <p className="ps-caption mt-2">Decks are shared with a team from the Share button inside a deck.</p>
              <button type="button" className="ps-link mt-2 text-[12px]" onClick={() => router.push("/#shared")}>
                See decks shared with you
              </button>
            </section>
          ) : null}
        </div>
        </div>
      </div>
    </AppShell>
  );
}
