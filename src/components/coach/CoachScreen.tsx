"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle, Microphone, Pause, Play, Stop, WarningCircle } from "@phosphor-icons/react";
import { useSpeechTranscript } from "@/hooks/useSpeechTranscript";
import { formatCoachTime, slideCoachTip, speechMetrics } from "@/lib/presenter-coach";
import { resolveTheme } from "@/lib/deck/themes";
import { FitSlide } from "@/components/canvas/FitSlide";
import { AppShell } from "@/components/shell/AppShell";
import { DeckNotFound } from "@/components/ui-kit/DeckNotFound";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { useDeck } from "@/components/present/useDeck";

type Props = { id: string };

export function CoachScreen({ id }: Props) {
  const { deck, status } = useDeck(id);
  const theme = useMemo(() => (deck ? resolveTheme(deck) : null), [deck]);
  const count = deck?.slides.length ?? 0;
  const [index, setIndex] = useState(0);
  const [active, setActive] = useState(false);
  const [finished, setFinished] = useState(false);
  const [times, setTimes] = useState<number[]>([]);
  const [now, setNow] = useState(Date.now());
  const segmentStartedAt = useRef(0);
  const activeRef = useRef(false);
  const speech = useSpeechTranscript();

  useEffect(() => setTimes(Array.from({ length: count }, () => 0)), [count, id]);
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  useEffect(() => () => { activeRef.current = false; speech.stop(); }, [speech.stop]);

  const closeSegment = useCallback(() => {
    if (!activeRef.current) return;
    const elapsed = Math.max(0, (Date.now() - segmentStartedAt.current) / 1000);
    setTimes((current) => current.map((value, slideIndex) => slideIndex === index ? value + elapsed : value));
  }, [index]);

  const stop = useCallback((complete: boolean) => {
    if (activeRef.current) closeSegment();
    activeRef.current = false;
    setActive(false);
    speech.stop();
    setFinished(complete);
  }, [closeSegment, speech.stop]);

  const begin = (target: number) => {
    segmentStartedAt.current = Date.now();
    activeRef.current = true;
    setNow(Date.now());
    setActive(true);
    setFinished(false);
    speech.start(target);
  };
  const start = () => begin(index);

  const moveTo = (target: number) => {
    const next = Math.max(0, Math.min(count - 1, target));
    if (next === index) return;
    if (activeRef.current) {
      closeSegment();
      segmentStartedAt.current = Date.now();
    }
    setIndex(next);
    speech.setCurrentSlide(next);
  };

  const restart = () => {
    activeRef.current = false;
    setActive(false);
    speech.stop();
    speech.clear();
    setTimes(Array.from({ length: count }, () => 0));
    setIndex(0);
    setFinished(false);
  };
  const startAgain = () => {
    speech.clear();
    setTimes(Array.from({ length: count }, () => 0));
    setIndex(0);
    begin(0);
  };

  const slideSeconds = (slideIndex: number) => (times[slideIndex] ?? 0) + (active && slideIndex === index ? (now - segmentStartedAt.current) / 1000 : 0);
  const slideEntries = speech.entries.filter((entry) => entry.slideIndex === index);
  const currentDuration = slideSeconds(index);
  const currentMetrics = speechMetrics(slideEntries, currentDuration);
  const allDuration = times.reduce((sum, value) => sum + value, 0) + (active ? (now - segmentStartedAt.current) / 1000 : 0);
  const totalMetrics = speechMetrics(speech.entries, allDuration);
  const tip = slideCoachTip(currentMetrics, currentDuration, slideEntries.length > 0);

  if (status === "loading") return <AppShell active="decks"><LoadingState label="Loading deck…" /></AppShell>;
  if (status === "missing" || !deck || !theme) return <AppShell active="decks"><DeckNotFound id={id} /></AppShell>;

  return (
    <AppShell active="decks" breadcrumbs={[{ label: "Decks", href: "/decks" }, { label: deck.title || "Untitled deck", href: `/deck/${encodeURIComponent(id)}` }, { label: "Presenter coach" }]}>
      <div className="ps-page mx-auto w-full pb-10">
        <header className="ps-page-hero mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="ps-heading">Presenter coach</h1>
            <p className="ps-body-lg mt-2">Rehearse one slide at a time and get feedback on pace, filler words and timing.</p>
          </div>
          <Link href={`/deck/${encodeURIComponent(id)}`} className="ps-btn"><ArrowLeft size={13} /> Back to deck</Link>
        </header>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.8fr)]">
          <section className="ps-glass min-w-0" aria-label={`Slide ${index + 1} of ${count}`}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="ps-cardcaption">{deck.title || "Untitled deck"}</p>
                <h2 className="ps-cardtitle mt-1">Slide {index + 1} <span className="font-normal text-[var(--ps-smoke)]">of {count}</span></h2>
              </div>
              <span className="rounded-full bg-[var(--ps-plate)] px-3 py-1.5 font-mono text-sm tabular-nums" aria-live="polite">{formatCoachTime(slideSeconds(index))}</span>
            </div>
            <FitSlide slide={deck.slides[index]} theme={theme} className="rounded-[var(--ps-r-sm)] bg-[var(--ps-plate)]" />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <button type="button" className="ps-btn" onClick={() => moveTo(index - 1)} disabled={index === 0}><ArrowLeft size={13} /> Previous</button>
              <div className="flex flex-wrap items-center justify-center gap-1.5" aria-label="Choose slide">
                {deck.slides.map((slide, slideIndex) => (
                  <button key={slide.id} type="button" className="grid size-8 place-items-center rounded-full text-xs transition-colors" data-active={slideIndex === index ? "true" : undefined} aria-label={`Go to slide ${slideIndex + 1}`} aria-current={slideIndex === index ? "step" : undefined} onClick={() => moveTo(slideIndex)} style={{ background: slideIndex === index ? "var(--ps-ink)" : "var(--ps-plate)", color: slideIndex === index ? "var(--ps-on-ink)" : "var(--ps-smoke)" }}>{slideIndex + 1}</button>
                ))}
              </div>
              <button type="button" className="ps-btn" onClick={() => moveTo(index + 1)} disabled={index >= count - 1}>Next <ArrowRight size={13} /></button>
            </div>
          </section>

          <aside className="flex min-w-0 flex-col gap-4">
            <section className="ps-glass">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div><p className="ps-cardcaption">Rehearsal</p><p className="mt-1 font-mono text-3xl tabular-nums text-[var(--ps-ink)]">{formatCoachTime(allDuration)}</p></div>
                {active ? <span className="ps-pill"><span className="size-2 animate-pulse rounded-full bg-[var(--ps-danger)]" />{speech.supported && !speech.error ? "Listening" : "Timer running"}</span> : null}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Metric label="Pace" value={totalMetrics.wordsPerMinute ? `${totalMetrics.wordsPerMinute}` : "—"} unit="wpm" />
                <Metric label="Filler words" value={String(totalMetrics.fillers)} />
                <Metric label="Words" value={String(totalMetrics.words)} />
              </div>
              {speech.supported ? <p className="ps-caption mt-2">Filler tracking covers common English terms such as “um”, “uh”, “erm”, “you know” and “basically”.</p> : null}
              <div className="mt-4 flex flex-wrap gap-2">
                {!active ? <button type="button" className="ps-btn ps-btn-primary" onClick={finished ? startAgain : start}>{speech.supported ? <Microphone size={14} weight="fill" /> : <Play size={14} weight="fill" />}{finished ? "Rehearse again" : speech.supported ? "Start rehearsal" : "Start timed rehearsal"}</button> : <button type="button" className="ps-btn" onClick={() => stop(false)}><Pause size={14} weight="fill" /> Pause</button>}
                {active ? <button type="button" className="ps-btn" onClick={() => stop(true)}><Stop size={14} weight="fill" /> Finish</button> : null}
                {finished ? <button type="button" className="ps-btn" onClick={restart}>Start over</button> : null}
              </div>
              {!speech.supported ? <p className="ps-caption mt-3">Speech metrics need a browser with speech recognition. The timer and per-slide feedback still work here.</p> : null}
              {speech.error ? <p className="ps-caption mt-3 flex items-start gap-1.5" role="status"><WarningCircle size={14} className="mt-0.5 shrink-0" />{speech.error}</p> : null}
              {speech.interim ? <p className="ps-caption mt-3" aria-live="polite">Hearing: {speech.interim}</p> : null}
              <p className="ps-caption mt-3">Your browser’s speech-recognition service may process microphone audio. Presenta keeps the transcript in memory in this tab; it is never uploaded to Presenta or saved.</p>
            </section>

            <section className="ps-glass">
              <p className="ps-cardcaption">Slide {index + 1} feedback</p>
              <p className="mt-2 text-sm leading-6 text-[var(--ps-ink)]">{tip}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-[var(--ps-r-sm)] bg-[var(--ps-plate)] p-3"><span className="block text-[var(--ps-ash)]">Slide pace</span><span className="mt-1 block font-medium tabular-nums text-[var(--ps-ink)]">{currentMetrics.wordsPerMinute ? `${currentMetrics.wordsPerMinute} wpm` : "Not enough speech yet"}</span></div>
                <div className="rounded-[var(--ps-r-sm)] bg-[var(--ps-plate)] p-3"><span className="block text-[var(--ps-ash)]">Time on slide</span><span className="mt-1 block font-medium tabular-nums text-[var(--ps-ink)]">{formatCoachTime(currentDuration)}</span></div>
              </div>
            </section>

            {finished ? <section className="ps-glass" role="status"><p className="flex items-center gap-2 ps-cardcaption"><CheckCircle size={15} /> Rehearsal complete</p><p className="ps-caption mt-2">You spoke {totalMetrics.words} words in {formatCoachTime(allDuration)} at {totalMetrics.wordsPerMinute || "—"} words per minute, with {totalMetrics.fillers} tracked filler words.</p></section> : null}
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function Metric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return <div className="rounded-[var(--ps-r-sm)] bg-[var(--ps-plate)] p-3"><span className="block text-[11px] text-[var(--ps-ash)]">{label}</span><span className="mt-1 block text-xl font-medium tabular-nums text-[var(--ps-ink)]">{value}<span className="ml-1 text-xs font-normal text-[var(--ps-smoke)]">{unit}</span></span></div>;
}
