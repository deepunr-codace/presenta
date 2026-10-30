"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ChatCircleDots, PaperPlaneRight } from "@phosphor-icons/react";
import { fetchPublicQuestions, postPublicQuestion, type AudienceQuestion } from "@/lib/collab";
import { getPublicVisitorId } from "@/lib/public-visitor";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = { token: string; slideNumber: number; open: boolean; onOpenChange: (open: boolean) => void };

export function PublicQuestionsDialog({ token, slideNumber, open, onOpenChange }: Props) {
  const [questions, setQuestions] = useState<AudienceQuestion[]>([]);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
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
      try { const rows = await fetchPublicQuestions(token); if (alive) { setQuestions(rows); setError(null); } }
      catch (e) { if (alive) setError(e instanceof Error ? e.message : "Could not load questions."); }
      finally { pending = false; if (alive) setLoading(false); }
    };
    setLoading(true);
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [open, token]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || body.trim().length < 3) return;
    setBusy(true); setError(null);
    try {
      setQuestions(await postPublicQuestion(token, { visitorId: getPublicVisitorId(), name: name.trim(), body: body.trim(), slideNumber }));
      setBody("");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not post your question."); }
    finally { setBusy(false); }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-xl" data-q-and-a>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><ChatCircleDots size={19} /> Audience Q&amp;A</DialogTitle>
        <DialogDescription>Ask the presenter a question. Your question is tagged to slide {slideNumber} and visible to other attendees.</DialogDescription>
      </DialogHeader>
      {error ? <p className="ps-caption" role="alert" style={{ color: "var(--ps-danger)" }}>{error}</p> : null}
      <div className="max-h-[38vh] overflow-y-auto">
        {loading ? <p className="ps-body py-6 text-center">Loading questions…</p> : questions.length ? <ul className="flex flex-col gap-2">{questions.map((question) => <li key={question.id} className="rounded-xl border border-[var(--ps-line)] p-3">
          <div className="flex items-center gap-2"><strong className="text-[13px]">{question.name}</strong><span className="ps-caption">Slide {question.slideNumber ?? "—"} · {new Date(question.createdAt).toLocaleTimeString()}</span>{question.answeredAt ? <span className="ml-auto ps-pill">Answered</span> : null}</div>
          <p className="mt-2 whitespace-pre-wrap text-[13px]">{question.body}</p>
        </li>)}</ul> : <p className="ps-body py-6 text-center">No questions yet. Be the first to ask.</p>}
      </div>
      <form onSubmit={(e) => void submit(e)} className="grid gap-2 border-t border-[var(--ps-line)] pt-3">
        <input className="ps-input" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)" aria-label="Your name, optional" />
        <textarea className="ps-input min-h-20 resize-y" maxLength={500} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Ask a question…" aria-label="Your question" />
        <button type="submit" className="ps-btn ps-btn-primary ps-btn-xs justify-self-end" disabled={busy || body.trim().length < 3}><PaperPlaneRight size={12} /> {busy ? "Sending…" : "Ask question"}</button>
      </form>
    </DialogContent>
  </Dialog>;
}
