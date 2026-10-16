"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowsClockwise, Sparkle, WifiSlash } from "@phosphor-icons/react";
import { postGenerate, sourceLabel, type AiSource } from "@/lib/api-client";
import { buildDeck } from "@/lib/deck/layouts";
import type { GenerateRequest } from "@/lib/deck/schema";
import { saveDeck } from "@/lib/persist";
import { GHOST_BTN, SECONDARY_BTN } from "@/lib/styles";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ErrorNotice } from "@/components/ui-kit/ErrorNotice";
import { StageList } from "@/components/ui-kit/StageList";
import { StepHeader } from "./StepHeader";
import { generateProgress, pushProgress, writtenSlides } from "./generate-progress";
import { generationInput, useWizardStore } from "./wizard-state";

const STAGES = ["Writing slides", "Designing layouts", "Applying brand", "Saving"] as const;
const STAGE_COPY = ["Writing the slide content…", "Placing text, cards and images on each slide…", "Applying your theme, accent and fonts…", "Saving the deck to this browser…"] as const;
const ROTATE_MS = 1600;
const HISTORY_MAX = 24;

type Status = { phase: "running"; stage: number; source: AiSource | null } | { phase: "error"; message: string; code: string } | { phase: "done"; source: AiSource };

const paint = () => new Promise<void>((r) => setTimeout(r, 60));

/** Step 4. Runs generation against the outline, brief and brand, builds the deck, saves it and hands off to /deck/[id]. */
export function GenerateStep() {
  const router = useRouter();
  const outline = useWizardStore((s) => s.outline);
  const setStep = useWizardStore((s) => s.setStep);
  const setDeckId = useWizardStore((s) => s.setDeckId);
  const [status, setStatus] = useState<Status>({ phase: "running", stage: 0, source: null });
  const [tick, setTick] = useState(0);
  /** Monotonic progress samples (one per rise of `written / n`); the bar shows the latest so it never moves backwards. */
  const [history, setHistory] = useState<number[]>([0]);
  /** Controller for a user-triggered retry; the auto-start effect owns its own. */
  const manualRef = useRef<AbortController | null>(null);

  /** Generate, build and save. Callers set the initial "running" status. */
  const run = useCallback(
    async (ac: AbortController) => {
      const state = useWizardStore.getState();
      const input = generationInput(state).slice(0, 40000);
      if (!input) {
        setStatus({ phase: "error", message: "The brief is empty. Go back and describe the deck first.", code: "empty" });
        return;
      }
      const brand = Object.keys(state.brand).length ? state.brand : undefined;
      const req: GenerateRequest = {
        mode: state.mode ?? "chat",
        input,
        slideCount: state.outline?.slides.length ?? state.settings.slideCount,
        tone: state.settings.tone,
        audience: state.brief.audience?.trim().slice(0, 80) || undefined,
        language: state.settings.language,
        themeId: state.themeId,
        outline: state.outline ?? undefined,
        brief: state.brief,
        brand,
      };

      const res = await postGenerate(req, ac.signal);
      if (ac.signal.aborted) return;
      if (!res.ok) {
        setStatus({ phase: "error", message: res.error, code: res.code });
        return;
      }

      try {
        setStatus({ phase: "running", stage: 1, source: res.source });
        await paint();
        const deck = buildDeck(res.data, req.themeId, {
          source: req.mode,
          prompt: input,
          audience: req.audience,
          tone: req.tone,
          brief: state.brief,
          outline: state.outline ?? undefined,
          brand,
        });
        setStatus({ phase: "running", stage: 2, source: res.source });
        await paint();
        setStatus({ phase: "running", stage: 3, source: res.source });
        await saveDeck(deck);
        if (ac.signal.aborted) return;
        setDeckId(deck.id);
        setStatus({ phase: "done", source: res.source });
        // Mark the wizard finished so returning to /new does not regenerate.
        setStep("review");
        router.push(`/deck/${deck.id}`);
      } catch (err) {
        setStatus({ phase: "error", message: err instanceof Error ? err.message : "Could not build the deck.", code: "build" });
      }
    },
    [router, setDeckId, setStep],
  );

  const retry = () => {
    manualRef.current?.abort();
    const ac = new AbortController();
    manualRef.current = ac;
    setStatus({ phase: "running", stage: 0, source: null });
    setTick(0);
    setHistory([0]);
    void run(ac);
  };

  // Start on arrival; the effect owns the controller so a remount aborts the first attempt and starts again.
  useEffect(() => {
    const ac = new AbortController();
    void Promise.resolve().then(() => (ac.signal.aborted ? undefined : run(ac)));
    return () => ac.abort();
  }, [run]);

  useEffect(() => () => manualRef.current?.abort(), []);

  // Rotate the "Slide n of N" line while the model writes.
  const writing = status.phase === "running" && status.stage === 0;
  useEffect(() => {
    if (!writing) return;
    const id = setInterval(() => setTick((t) => t + 1), ROTATE_MS);
    return () => clearInterval(id);
  }, [writing]);

  const titles = outline?.slides.map((s) => s.title) ?? [];
  const n = titles.length;
  const stageIndex = status.phase === "done" ? STAGES.length : status.phase === "running" ? status.stage : -1;
  const source = status.phase === "running" || status.phase === "done" ? status.source : null;
  // One series drives the count, the percent and the bar (see generate-progress.ts).
  const written = writtenSlides(status, n, tick);
  const progress = generateProgress(status, n, tick);
  const percent = Math.round(progress * 100);
  const current = Math.min(written, Math.max(0, n - 1));

  // Record a sample whenever progress rises (state derived during render); the series is monotonic by construction.
  const nextHistory = pushProgress(history, progress, HISTORY_MAX);
  if (nextHistory !== history) setHistory(nextHistory);
  const shown = nextHistory[nextHistory.length - 1] ?? 0;

  return (
    <div className="space-y-5">
      <StepHeader title="Generate" hint="Writing and designing your slides. This usually takes under a minute." />

      {status.phase === "error" ? (
        <ErrorNotice
          title="Generation failed"
          message={status.message}
          code={status.code}
          actions={
            <>
              <Button variant="outline" size="sm" className={SECONDARY_BTN} onClick={retry}>
                <ArrowsClockwise data-icon="inline-start" /> Retry
              </Button>
              <Button variant="ghost" size="sm" className={GHOST_BTN} onClick={() => setStep("brand")}>
                <ArrowLeft data-icon="inline-start" /> Back
              </Button>
            </>
          }
        />
      ) : (
        <section className="ps-glass" aria-live="polite" aria-busy={status.phase === "running"}>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <p className="text-[16px] leading-6 text-[var(--ps-ink)]" aria-label={`${written} of ${n} slides written`}>
              <span className="tabular-nums">{written}</span> of <span className="tabular-nums">{n || "–"}</span> slides
              <span className="text-[var(--ps-ash)]"> · {status.phase === "done" ? "all written" : stageIndex === 0 ? "writing" : "written"}</span>
            </p>
            <span className="ps-caption tabular-nums">{percent}%</span>
          </div>
          <div className="ps-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Generation progress">
            <span style={{ width: `${Math.round(shown * 100)}%` }} />
          </div>

          <StageList stages={STAGES} active={stageIndex} columns className="mt-5 border-t border-[var(--ps-line)] pt-5" />

          <div className="ps-tile mt-5 px-4 py-3">
            <p className="ps-cardcaption">Now</p>
            <p className="mt-1 min-h-5 text-[14px] leading-6 text-[var(--ps-ink)]">
              {status.phase === "done" ? (
                "Deck saved. Opening the review page…"
              ) : stageIndex === 0 && n ? (
                <>
                  <span className="tabular-nums text-[var(--ps-smoke)]">
                    Slide {current + 1} of {n}:
                  </span>{" "}
                  <span className="font-medium">{titles[current]}</span>
                </>
              ) : (
                STAGE_COPY[Math.max(0, stageIndex)]
              )}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <p className="ps-cardcaption">You can edit every slide on the next screen.</p>
            {source ? (
              <span className="ps-pill" data-tone={source !== "mock" ? "success" : "warning"}>
                {source !== "mock" ? <Sparkle weight="fill" /> : <WifiSlash weight="bold" />}
                {sourceLabel(source)}
              </span>
            ) : null}
          </div>
        </section>
      )}

      <footer className="flex items-center pt-2">
        <Button variant="outline" className={cn(SECONDARY_BTN, "h-9 px-4")} onClick={() => setStep("brand")} disabled={status.phase === "done"}>
          <ArrowLeft data-icon="inline-start" /> Back
        </Button>
      </footer>
    </div>
  );
}
