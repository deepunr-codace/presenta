"use client";

import { cn } from "@/lib/utils";
import { StepItem, type StepState } from "./StepItem";
import { STEP_ORDER, reachableSteps, stepIndex, useWizardStore } from "./wizard-state";

type Props = { className?: string };

/** Left column: the five steps as a vertical stepper (DESIGN.md §5); a horizontal row of circles on narrow screens. */
export function Stepper({ className }: Props) {
  const step = useWizardStore((s) => s.step);
  const deckId = useWizardStore((s) => s.deckId);
  const setStep = useWizardStore((s) => s.setStep);
  const current = stepIndex(step);
  const reachable = reachableSteps({ step, deckId });

  return (
    <nav aria-label="Steps" className={cn("min-w-0 max-w-full", className)}>
      <ol className="ps-stepper">
        {STEP_ORDER.map((id, i) => {
          const state: StepState = i < current ? "done" : i === current ? "current" : "upcoming";
          return (
            <li key={id}>
              <StepItem id={id} index={i} state={state} clickable={reachable.has(id) && id !== step} deckId={deckId} onClick={() => setStep(id)} />
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
