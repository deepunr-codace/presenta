"use client";

import { useEffect, useState, type ComponentType } from "react";
import { ArrowCounterClockwise } from "@phosphor-icons/react";
import { SECONDARY_BTN } from "@/lib/styles";
import { cn } from "@/lib/utils";
import { AppShell } from "@/components/shell/AppShell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BrandStep } from "./BrandStep";
import { BriefStep } from "./BriefStep";
import { ContextPanel } from "./ContextPanel";
import { GenerateStep } from "./GenerateStep";
import { OutlineStep } from "./OutlineStep";
import { ReviewStep } from "./ReviewStep";
import { StepBoundary } from "./StepBoundary";
import { StepSkeleton } from "./StepSkeleton";
import { Stepper } from "./Stepper";
import { STEP_META, STEP_ORDER, clearWizard, stepIndex, useWizardStore, type WizardStep } from "./wizard-state";

const STEP_VIEW: Record<WizardStep, ComponentType> = {
  brief: BriefStep,
  outline: OutlineStep,
  brand: BrandStep,
  generate: GenerateStep,
  review: ReviewStep,
};

/**
 * Guided deck creation at /new: Brief → Outline → Brand → Generate → Review.
 * State lives in the persisted wizard store; this component owns hydration,
 * the chrome (breadcrumb, stepper, context panel) and step routing.
 */
export function Wizard() {
  const hydrated = useWizardStore((s) => s.hydrated);
  const step = useWizardStore((s) => s.step);
  const setHydrated = useWizardStore((s) => s.setHydrated);
  const hasProgress = useWizardStore((s) => s.mode !== null || s.outline !== null);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    let alive = true;
    void Promise.resolve(useWizardStore.persist.rehydrate()).then(() => {
      if (alive) setHydrated(true);
    });
    return () => {
      alive = false;
    };
  }, [setHydrated]);

  const index = stepIndex(step);
  const StepView = STEP_VIEW[step];

  return (
    <AppShell
      active="new"
      breadcrumbs={[{ label: "Studio", href: "/" }, { label: "New deck" }]}
      actions={
        <>
          <p className="ps-body hidden whitespace-nowrap text-[13px] sm:block" aria-live="polite">
            Step <span className="font-medium text-[var(--ps-ink)]">{index + 1}</span> of {STEP_ORDER.length} · {STEP_META[step].label}
          </p>
          <Button variant="outline" size="sm" className={cn(SECONDARY_BTN, "h-8 px-3.5")} onClick={() => setConfirmReset(true)} disabled={!hydrated || !hasProgress}>
            <ArrowCounterClockwise data-icon="inline-start" /> Start over
          </Button>
        </>
      }
    >
      <div className="ps-page">
        {/* Explicit single column under lg: an auto-sized implicit column would grow to the context panel's intrinsic width. */}
        <main className="grid w-full grid-cols-1 gap-8 lg:grid-cols-[220px_minmax(0,1fr)_280px] lg:gap-10">
          <Stepper className="lg:sticky lg:top-0 lg:self-start lg:pt-2" />
          <div className="mx-auto w-full max-w-[720px] min-w-0">
            {hydrated ? (
              <StepBoundary key={step}>
                <StepView />
              </StepBoundary>
            ) : (
              <StepSkeleton />
            )}
          </div>
          <ContextPanel className={cn("lg:sticky lg:top-0 lg:self-start", !hydrated && "opacity-0")} />
        </main>
      </div>

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start over?</DialogTitle>
            <DialogDescription>This clears the brief, outline and brand settings for this deck. Saved decks are not affected.</DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton>
            <Button
              variant="destructive"
              onClick={() => {
                clearWizard();
                setConfirmReset(false);
              }}
            >
              Start over
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
