"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowSquareOut, CaretLeft, CaretRight, ChartBar, ChatCircleDots, X } from "@phosphor-icons/react";
import type { Deck } from "@/lib/deck/schema";
import { STAGE_H, STAGE_W } from "@/lib/deck/schema";
import { resolveTheme } from "@/lib/deck/themes";
import { fetchPublicPoll, recordPublicShareEvent } from "@/lib/collab";
import { getPublicVisitorId } from "@/lib/public-visitor";
import { SlideRenderer } from "@/components/canvas/SlideRenderer";
import { PublicQuestionsDialog } from "./PublicQuestionsDialog";
import { PublicPollDialog } from "./PublicPollDialog";

export function PublicDeckView({ deck, token, embed = false }: { deck: Deck; token: string; embed?: boolean }) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [controls, setControls] = useState(true);
  const [questionsOpen, setQuestionsOpen] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [hasLivePoll, setHasLivePoll] = useState(false);
  const idleTimer = useRef<number | null>(null);
  const theme = useMemo(() => resolveTheme(deck), [deck]);
  const count = deck.slides.length;
  const slide = deck.slides[Math.min(index, Math.max(0, count - 1))];
  const navigate = useCallback((target: number) => setIndex((current) => {
    const next = Math.max(0, Math.min(count - 1, target));
    if (next !== current) setDirection(next > current ? "forward" : "backward");
    return next;
  }), [count]);

  useEffect(() => {
    let visitorId: string;
    try {
      const key = "presenta:public-visitor-id";
      visitorId = window.localStorage.getItem(key) ?? window.crypto.randomUUID();
      window.localStorage.setItem(key, visitorId);
    } catch { visitorId = window.crypto.randomUUID(); }
    void recordPublicShareEvent(token, visitorId, "view");
  }, [token]);

  useEffect(() => {
    let alive = true;
    let pending = false;
    const load = async () => {
      if (pending) return;
      pending = true;
      try { const poll = await fetchPublicPoll(token, getPublicVisitorId()); if (alive) setHasLivePoll(Boolean(poll)); }
      catch { if (alive) setHasLivePoll(false); }
      finally { pending = false; }
    };
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [token]);

  useEffect(() => {
    if (index === 0) return;
    try {
      const key = "presenta:public-visitor-id";
      const visitorId = window.localStorage.getItem(key);
      if (visitorId) void recordPublicShareEvent(token, visitorId, "present");
    } catch { /* private browsing can disable local storage; the view is still rendered */ }
  }, [index, token]);

  useEffect(() => {
    const measure = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if ((e.target as HTMLElement | null)?.closest("[data-q-and-a], [data-audience-poll]")) return;
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") { e.preventDefault(); navigate(index + 1); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); navigate(index - 1); }
      else if (e.key === "Home") navigate(0);
      else if (e.key === "End") navigate(count - 1);
      else if (e.key === "Escape" && !embed) window.history.back();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [count, embed, index, navigate]);

  useEffect(() => {
    const showControls = () => {
      setControls(true);
      if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(() => setControls(false), 2500);
    };
    showControls();
    window.addEventListener("mousemove", showControls);
    window.addEventListener("keydown", showControls);
    return () => {
      window.removeEventListener("mousemove", showControls);
      window.removeEventListener("keydown", showControls);
      if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
    };
  }, []);

  const scale = viewport.width && viewport.height ? Math.max(0.01, Math.min(viewport.width / STAGE_W, viewport.height / STAGE_H)) : 0.01;

  return <main className={`ps-public-deck${embed ? " ps-public-deck-embed" : ""}`}>
    <div className="ps-public-deck-stage" onClick={() => navigate(index + 1)}>
      {slide ? <div key={slide.id} className="ps-slide-enter" data-transition={slide.transition ?? "none"} data-direction={direction} style={{ width: Math.round(STAGE_W * scale), height: Math.round(STAGE_H * scale), overflow: "hidden", position: "relative" }}><SlideRenderer slide={slide} theme={theme} scale={scale} /></div> : null}
    </div>
    <header className="ps-public-deck-header" data-visible={controls || undefined}>
      <span className="ps-public-deck-title">{deck.title || "Shared presentation"}</span>
      {!embed ? <span className="ps-public-deck-label">Shared view</span> : null}
      {hasLivePoll ? <button type="button" className="ps-present-ctl" title="Vote in the live poll" onClick={(e) => { e.stopPropagation(); setPollOpen(true); }}><ChartBar size={15} /> Poll</button> : null}
      <button type="button" className="ps-present-ctl" title="Ask the presenter" onClick={(e) => { e.stopPropagation(); setQuestionsOpen(true); }}><ChatCircleDots size={15} /> Q&amp;A</button>
      {embed ? <a className="ps-present-ctl" href={`/s/${encodeURIComponent(token)}`} target="_blank" rel="noreferrer" title="Open the full viewer"><ArrowSquareOut size={15} /> Open</a> : <button type="button" className="ps-present-ctl" aria-label="Close shared presentation" title="Close (Esc)" onClick={() => window.history.back()}><X size={15} weight="bold" /></button>}
    </header>
    <nav className="ps-public-deck-controls" data-visible={controls || undefined} aria-label="Slide controls">
      <button type="button" className="ps-present-ctl" aria-label="Previous slide" disabled={index === 0} onClick={(e) => { e.stopPropagation(); navigate(index - 1); }}><CaretLeft size={15} weight="bold" /></button>
      <span aria-live="polite">{index + 1} / {count}</span>
      <button type="button" className="ps-present-ctl" aria-label="Next slide" disabled={index >= count - 1} onClick={(e) => { e.stopPropagation(); navigate(index + 1); }}><CaretRight size={15} weight="bold" /></button>
    </nav>
    <PublicQuestionsDialog token={token} slideNumber={index + 1} open={questionsOpen} onOpenChange={setQuestionsOpen} />
    <PublicPollDialog token={token} open={pollOpen} onOpenChange={setPollOpen} />
  </main>;
}
