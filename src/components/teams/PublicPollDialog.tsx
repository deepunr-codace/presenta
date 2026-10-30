"use client";

import { useEffect, useState } from "react";
import { ChartBar } from "@phosphor-icons/react";
import { fetchPublicPoll, votePublicPoll, type AudiencePoll } from "@/lib/collab";
import { getPublicVisitorId } from "@/lib/public-visitor";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type LivePoll = AudiencePoll & { myVote: number | null };
type Props = { token: string; open: boolean; onOpenChange: (open: boolean) => void };

export function PublicPollDialog({ token, open, onOpenChange }: Props) {
  const [poll, setPoll] = useState<LivePoll | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    let pending = false;
    const load = async () => {
      if (pending) return;
      pending = true;
      try { const result = await fetchPublicPoll(token, getPublicVisitorId()); if (alive) { setPoll(result); setError(null); } }
      catch (e) { if (alive) setError(e instanceof Error ? e.message : "Could not load the poll."); }
      finally { pending = false; if (alive) setLoading(false); }
    };
    setLoading(true);
    void load();
    const timer = window.setInterval(() => void load(), 4000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [open, token]);

  const vote = async (optionIndex: number) => {
    if (!poll || busy) return;
    setBusy(true); setError(null);
    try { setPoll(await votePublicPoll(token, { visitorId: getPublicVisitorId(), pollId: poll.id, optionIndex })); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not submit your vote."); }
    finally { setBusy(false); }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-lg" data-audience-poll>
      <DialogHeader><DialogTitle className="flex items-center gap-2"><ChartBar size={19} /> Live poll</DialogTitle><DialogDescription>Vote once. You can change your answer while the poll is open.</DialogDescription></DialogHeader>
      {error ? <p className="ps-caption" role="alert" style={{ color: "var(--ps-danger)" }}>{error}</p> : null}
      {loading && !poll ? <p className="ps-body py-8 text-center">Loading poll…</p> : poll ? <>
        <h3 className="text-[15px] font-medium">{poll.prompt}</h3>
        <ul className="grid gap-2">{poll.options.map((option, i) => {
          const count = poll.voteCounts[i] ?? 0;
          const percent = poll.totalVotes ? Math.round(count / poll.totalVotes * 100) : 0;
          return <li key={`${poll.id}-${i}`}>
            <button type="button" className={`ps-btn w-full justify-between ${poll.myVote === i ? "ps-btn-primary" : ""}`} aria-pressed={poll.myVote === i} disabled={busy} onClick={() => void vote(i)}>
              <span className="min-w-0 truncate">{option}</span><span className="ps-caption ml-3 shrink-0">{poll.totalVotes ? `${percent}% · ${count}` : "Vote"}</span>
            </button>
          </li>;
        })}</ul>
        <p className="ps-caption text-right">{poll.totalVotes} {poll.totalVotes === 1 ? "vote" : "votes"}</p>
      </> : <p className="ps-body py-8 text-center">The poll has ended.</p>}
    </DialogContent>
  </Dialog>;
}
