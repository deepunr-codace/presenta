"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ChartBar, Stop } from "@phosphor-icons/react";
import { createDeckAudiencePoll, endDeckAudiencePoll, fetchDeckAudiencePolls, type AudiencePoll } from "@/lib/collab";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = { id: string; open: boolean; onOpenChange: (open: boolean) => void };

export function AudiencePollsDialog({ id, open, onOpenChange }: Props) {
  const [polls, setPolls] = useState<AudiencePoll[]>([]);
  const [prompt, setPrompt] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const active = polls.find((poll) => !poll.endedAt);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    let pending = false;
    const load = async () => {
      if (pending) return;
      pending = true;
      try { const rows = await fetchDeckAudiencePolls(id); if (alive) { setPolls(rows); setError(null); } }
      catch (e) { if (alive) setError(e instanceof Error ? e.message : "Could not load polls."); }
      finally { pending = false; }
    };
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [id, open]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { setPolls(await createDeckAudiencePoll(id, prompt, options)); setPrompt(""); setOptions(["", ""]); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not start the poll."); }
    finally { setBusy(false); }
  };

  const stop = async () => {
    if (!active) return;
    setBusy(true); setError(null);
    try { setPolls(await endDeckAudiencePoll(id, active.id)); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not end the poll."); }
    finally { setBusy(false); }
  };

  const changeOption = (index: number, value: string) => setOptions((current) => current.map((option, i) => i === index ? value : option));
  const totalVotes = (poll: AudiencePoll) => poll.totalVotes;

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-xl">
      <DialogHeader><DialogTitle className="flex items-center gap-2"><ChartBar size={19} /> Live audience poll</DialogTitle><DialogDescription>Attendees can vote from the public share view. Only one poll can be active at a time.</DialogDescription></DialogHeader>
      {error ? <p className="ps-caption" role="alert" style={{ color: "var(--ps-danger)" }}>{error}</p> : null}
      {active ? <section className="rounded-xl border border-[var(--ps-line)] p-3">
        <div className="flex items-start justify-between gap-3"><div><span className="ps-pill">Live</span><h3 className="mt-2 text-[14px] font-medium">{active.prompt}</h3></div><button type="button" className="ps-btn ps-btn-xs" disabled={busy} onClick={() => void stop()}><Stop size={12} /> End poll</button></div>
        <ul className="mt-3 flex flex-col gap-2">{active.options.map((option, i) => <li key={`${active.id}-${i}`} className="text-[13px]">{option}<span className="ps-caption ml-2">{active.voteCounts[i] ?? 0} votes</span></li>)}</ul>
        <p className="ps-caption mt-2">{totalVotes(active)} total votes</p>
      </section> : <form onSubmit={(e) => void create(e)} className="grid gap-2">
        <label className="ps-label" htmlFor="audience-poll-prompt">Poll question</label>
        <input id="audience-poll-prompt" className="ps-input" maxLength={200} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="What should we prioritize next?" />
        <div className="grid gap-2 sm:grid-cols-2">{options.map((option, i) => <label key={i} className="grid gap-1"><span className="ps-caption">Option {i + 1}</span><input className="ps-input" maxLength={80} value={option} onChange={(e) => changeOption(i, e.target.value)} /></label>)}</div>
        {options.length < 6 ? <button type="button" className="ps-link justify-self-start text-[13px]" onClick={() => setOptions((current) => [...current, ""])}>Add option</button> : null}
        {options.length > 2 ? <button type="button" className="ps-link justify-self-start text-[13px]" onClick={() => setOptions((current) => current.slice(0, -1))}>Remove last option</button> : null}
        <button type="submit" className="ps-btn ps-btn-primary ps-btn-xs justify-self-end" disabled={busy || prompt.trim().length < 3 || options.filter((option) => option.trim()).length < 2}>{busy ? "Starting…" : "Start poll"}</button>
      </form>}
      <div className="max-h-[25vh] overflow-y-auto border-t border-[var(--ps-line)] pt-3">
        <h3 className="ps-label mb-2">Recent polls</h3>
        {polls.filter((poll) => poll.endedAt).slice(0, 5).map((poll) => <div key={poll.id} className="mb-2 rounded-lg bg-[var(--ps-plate)] p-2"><strong className="text-[13px]">{poll.prompt}</strong><p className="ps-caption mt-1">{poll.totalVotes} votes · {poll.options.map((option, i) => `${option}: ${poll.voteCounts[i] ?? 0}`).join(" · ")}</p></div>)}
        {!polls.some((poll) => poll.endedAt) ? <p className="ps-caption">No ended polls yet.</p> : null}
      </div>
    </DialogContent>
  </Dialog>;
}
