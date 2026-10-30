"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ChatCircleDots, Check, PaperPlaneRight } from "@phosphor-icons/react";
import { fetchDeckComments, postDeckComment, resolveDeckComment, type DeckComment } from "@/lib/collab";
import { useDeckStore } from "@/store/deck-store";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = { id: string; open: boolean; onOpenChange: (open: boolean) => void };

export function CommentsDialog({ id, open, onOpenChange }: Props) {
  const selectedSlideId = useDeckStore((s) => s.selectedSlideId);
  const deck = useDeckStore((s) => (s.deck?.id === id ? s.deck : null));
  const slideNumber = useMemo(() => deck?.slides.findIndex((s) => s.id === selectedSlideId) ?? -1, [deck, selectedSlideId]);
  const [comments, setComments] = useState<DeckComment[]>([]);
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<DeckComment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    let fetching = false;
    let hasLoaded = false;
    const load = async () => {
      if (fetching) return;
      fetching = true;
      try { const rows = await fetchDeckComments(id); hasLoaded = true; if (alive) { setComments(rows); setError(null); } }
      catch (e) { if (alive && !hasLoaded) setError(e instanceof Error ? e.message : "Could not load comments."); }
      finally { fetching = false; }
    };
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [open, id]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setComments(await postDeckComment(id, body, replyTo?.slideId ?? selectedSlideId, replyTo?.id ?? null));
      setBody("");
      setReplyTo(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not post your comment.");
    } finally { setBusy(false); }
  };

  const toggleResolved = async (comment: DeckComment) => {
    setError(null);
    try { setComments(await resolveDeckComment(id, comment.id, !comment.resolvedAt)); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not update that thread."); }
  };

  const roots = comments.filter((c) => !c.parentId);
  const repliesFor = (id: string) => comments.filter((c) => c.parentId === id);

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-xl">
      <DialogHeader><DialogTitle className="flex items-center gap-2"><ChatCircleDots size={20} /> Comments</DialogTitle><DialogDescription>Discuss the deck with people who have access. New comments are attached to slide {slideNumber >= 0 ? slideNumber + 1 : "—"}.</DialogDescription></DialogHeader>
      {error ? <p className="ps-caption" role="alert" style={{ color: "var(--ps-danger)" }}>{error}</p> : null}
      <div className="max-h-[48vh] overflow-y-auto pr-1">
        {roots.length ? <ul className="flex flex-col gap-3">{roots.map((c) => <li key={c.id} className="rounded-xl border border-[var(--ps-line)] p-3" data-resolved={Boolean(c.resolvedAt)}>
          <div className="flex items-start justify-between gap-3"><div><strong className="text-[13px]">{c.name}</strong><span className="ps-caption ml-2">{c.slideId ? `Slide ${(deck?.slides.findIndex((s) => s.id === c.slideId) ?? -1) + 1}` : "Deck"} · {new Date(c.createdAt).toLocaleString()}</span></div><button type="button" className="ps-btn ps-btn-xs" onClick={() => void toggleResolved(c)}><Check size={12} /> {c.resolvedAt ? "Reopen" : "Resolve"}</button></div>
          <p className="mt-2 whitespace-pre-wrap text-[13px]">{c.body}</p>
          {repliesFor(c.id).map((reply) => <div key={reply.id} className="ml-4 mt-3 border-l-2 border-[var(--ps-line)] pl-3"><strong className="text-[13px]">{reply.name}</strong><span className="ps-caption ml-2">{new Date(reply.createdAt).toLocaleString()}</span><p className="mt-1 whitespace-pre-wrap text-[13px]">{reply.body}</p></div>)}
          <button type="button" className="ps-link mt-3 text-[12px]" onClick={() => setReplyTo(c)}>Reply</button>
        </li>)}</ul> : <p className="ps-body py-8 text-center">No comments yet. Start the conversation.</p>}
      </div>
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-2 border-t border-[var(--ps-line)] pt-3">
        {replyTo ? <button type="button" className="ps-caption self-start underline" onClick={() => setReplyTo(null)}>Replying to {replyTo.name} · cancel</button> : null}
        <textarea className="ps-input min-h-20 resize-y" maxLength={4000} placeholder={replyTo ? "Write a reply…" : "Add a comment…"} value={body} onChange={(e) => setBody(e.target.value)} />
        <button type="submit" className="ps-btn ps-btn-primary ps-btn-xs self-end" disabled={busy || !body.trim()}><PaperPlaneRight size={12} /> {busy ? "Posting…" : "Comment"}</button>
      </form>
    </DialogContent>
  </Dialog>;
}
