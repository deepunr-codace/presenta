"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowsClockwise } from "@phosphor-icons/react";
import { postOutline } from "@/lib/api-client";
import type { OutlineRequest } from "@/lib/deck/schema";
import { GHOST_BTN, PRIMARY_BTN, SECONDARY_BTN } from "@/lib/styles";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ErrorNotice } from "@/components/ui-kit/ErrorNotice";
import { OutlineEditor } from "./OutlineEditor";
import { OutlineFacts } from "./OutlineFacts";
import { OutlineLoading } from "./OutlineLoading";
import { StepHeader } from "./StepHeader";
import { useWizardStore } from "./wizard-state";

const STAGE_TIMINGS = [0, 1400, 3200] as const;

type Status = { phase: "idle" } | { phase: "loading"; stage: number } | { phase: "error"; message: string };

/** Step 2. Builds the outline from the brief, then lets the user edit it before moving on to Brand. */
export function OutlineStep() {
  const mode = useWizardStore((s) => s.mode);
  const brief = useWizardStore((s) => s.brief);
  const settings = useWizardStore((s) => s.settings);
  const outline = useWizardStore((s) => s.outline);
  const setOutline = useWizardStore((s) => s.setOutline);
  const setStep = useWizardStore((s) => s.setStep);
  const [status, setStatus] = useState<Status>(() => (outline ? { phase: "idle" } : { phase: "loading", stage: 0 }));
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  /** Controller for a user-triggered regenerate; the auto-build effect owns its own. */
  const manualRef = useRef<AbortController | null>(null);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);
  const startTimers = useCallback(() => {
    clearTimers();
    timers.current = STAGE_TIMINGS.slice(1).map((ms, i) => setTimeout(() => setStatus((s) => (s.phase === "loading" && s.stage < i + 1 ? { ...s, stage: i + 1 } : s)), ms));
  }, [clearTimers]);

  /** Request the outline; only sets state after the response. */
  const request = useCallback(
    async (ac: AbortController) => {
      const state = useWizardStore.getState();
      const req: OutlineRequest = {
        mode: state.mode ?? "chat",
        brief: state.brief,
        slideCount: state.settings.slideCount,
        tone: state.settings.tone,
        language: state.settings.language,
      };
      const res = await postOutline(req, ac.signal);
      if (ac.signal.aborted) return;
      clearTimers();
      if (!res.ok) {
        setStatus({ phase: "error", message: res.error });
        return;
      }
      setOutline(res.data);
      setStatus({ phase: "idle" });
    },
    [setOutline, clearTimers],
  );

  const regenerate = () => {
    manualRef.current?.abort();
    const ac = new AbortController();
    manualRef.current = ac;
    setStatus({ phase: "loading", stage: 0 });
    startTimers();
    void request(ac);
  };

  // Build automatically when arriving without an outline; the effect owns its controller so a remount simply refires.
  useEffect(() => {
    if (outline) return;
    const ac = new AbortController();
    startTimers();
    void Promise.resolve().then(() => request(ac));
    return () => {
      ac.abort();
      clearTimers();
    };
  }, [outline, request, startTimers, clearTimers]);

  useEffect(() => () => manualRef.current?.abort(), []);

  const loading = status.phase === "loading";
  const audience = brief.audience?.trim();

  return (
    <div className="space-y-5">
      <StepHeader title="Outline" hint="Rename, reorder or reshape slides before anything is written.">
        {outline ? (
          <Button variant="outline" size="sm" className={cn(SECONDARY_BTN, "h-8 px-3.5")} onClick={regenerate} disabled={loading}>
            <ArrowsClockwise data-icon="inline-start" className={cn(loading && "animate-spin")} /> Regenerate outline
          </Button>
        ) : null}
      </StepHeader>

      <OutlineFacts
        facts={[
          { label: "Slides", value: String(outline?.slides.length ?? settings.slideCount) },
          { label: "Tone", value: settings.tone },
          { label: "Language", value: settings.language },
          { label: "Audience", value: audience || "General" },
          { label: "Source", value: mode === "paste" ? "Pasted content" : "Conversation" },
        ]}
      />

      {status.phase === "error" ? (
        <ErrorNotice
          title="Could not build the outline"
          message={status.message}
          actions={
            <>
              <Button variant="outline" size="sm" className={cn(SECONDARY_BTN, "h-8 px-3.5")} onClick={regenerate}>
                <ArrowsClockwise data-icon="inline-start" /> Retry
              </Button>
              <Button variant="ghost" size="sm" className={cn(GHOST_BTN, "h-8 px-3")} onClick={() => setStep("brief")}>
                <ArrowLeft data-icon="inline-start" /> Back to brief
              </Button>
            </>
          }
        />
      ) : null}

      {loading ? <OutlineLoading stage={status.stage} /> : outline ? <OutlineEditor outline={outline} onChange={setOutline} /> : null}

      <footer className="flex items-center justify-between gap-3 pt-2">
        <Button variant="outline" className={cn(SECONDARY_BTN, "h-9 px-4")} onClick={() => setStep("brief")}>
          <ArrowLeft data-icon="inline-start" /> Back
        </Button>
        <Button className={cn(PRIMARY_BTN, "h-9 px-4")} onClick={() => setStep("brand")} disabled={!outline || loading}>
          Continue <ArrowRight data-icon="inline-end" weight="bold" />
        </Button>
      </footer>
    </div>
  );
}
