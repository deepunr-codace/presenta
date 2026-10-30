"use client";

import { useEffect, useState } from "react";
import { ChatCircleDots, Eye, EyeSlash } from "@phosphor-icons/react";
import { fetchDeckAudienceQuestions, moderateDeckQuestion, type AudienceQuestion } from "@/lib/collab";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = { id: string; open: boolean; onOpenChange: (open: boolean) => void };

export function AudienceQuestionsDialog({ id, open, onOpenChange }: Props) {
  const [questions, setQuestions] = useState<AudienceQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    let pending = false;
    const load = async () => {
      if (pending) return;
      pending = true;
      try { const rows = await fetchDeckAudienceQuestions(id); if (alive) { setQuestions(rows); setError(null); } }
      catch (e) { if (alive) setError(e instanceof Error ? e.message : "Could not load questions."); }
      finally { pending = false; }
    };
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [id, open]);

  const update = async (question: AudienceQuestion, patch: { hidden?: boolean; answered?: boolean }) => {
    setBusyId(question.id); setError(null);
    try { setQuestions(await moderateDeckQuestion(id, question.id, patch)); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not update that question."); }
    finally { setBusyId(null); }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-xl">
      <DialogHeader><DialogTitle className="flex items-center gap-2"><ChatCircleDots size={19} /> Audience questions</DialogTitle><DialogDescription>Questions from people viewing this deck’s public share link. Hide inappropriate questions or mark ones you’ve answered.</DialogDescription></DialogHeader>
      {error ? <p className="ps-caption" role="alert" style={{ color: "var(--ps-danger)" }}>{error}</p> : null}
      <div className="max-h-[55vh] overflow-y-auto">
        {questions.length ? <ul className="flex flex-col gap-2">{questions.map((question) => <li key={question.id} className="rounded-xl border border-[var(--ps-line)] p-3" data-hidden={Boolean(question.hiddenAt)}>
          <div className="flex items-center gap-2"><strong className="text-[13px]">{question.name}</strong><span className="ps-caption">{question.slideNumber ? `Slide ${question.slideNumber} · ` : ""}{new Date(question.createdAt).toLocaleString()}</span>{question.hiddenAt ? <span className="ml-auto ps-pill">Hidden</span> : question.answeredAt ? <span className="ml-auto ps-pill">Answered</span> : null}</div>
          <p className="mt-2 whitespace-pre-wrap text-[13px]">{question.body}</p>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" className="ps-btn ps-btn-xs" disabled={busyId === question.id} onClick={() => void update(question, { answered: !question.answeredAt })}>{question.answeredAt ? "Unmark answered" : "Mark answered"}</button>
            <button type="button" className="ps-btn ps-btn-xs" disabled={busyId === question.id} onClick={() => void update(question, { hidden: !question.hiddenAt })}>{question.hiddenAt ? <><Eye size={12} /> Show</> : <><EyeSlash size={12} /> Hide</>}</button>
          </div>
        </li>)}</ul> : <p className="ps-body py-8 text-center">No audience questions yet.</p>}
      </div>
    </DialogContent>
  </Dialog>;
}
