"use client";

import Link from "next/link";
import { Check } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { STEP_META, type WizardStep } from "./wizard-state";

export type StepState = "done" | "current" | "upcoming";

type Props = {
  id: WizardStep;
  index: number;
  state: StepState;
  clickable: boolean;
  deckId: string | null;
  onClick: () => void;
};

/** One stepper row: 24 px circle, label and hint (label only for the current step under lg). Done steps are buttons; Review links to the deck once it exists. */
export function StepItem({ id, index, state, clickable, deckId, onClick }: Props) {
  const meta = STEP_META[id];
  const inner = (
    <>
      <span className="ps-stepmark" data-state={state} aria-hidden>
        {state === "done" ? <Check size={12} weight="bold" /> : index + 1}
      </span>
      {/* Under lg the stepper is a horizontal row of circles: only the current step shows its label so nothing clips at 390 px. */}
      <span className={cn("min-w-0", state !== "current" && "hidden lg:block")}>
        <span className={cn("block text-[14px] leading-7 font-medium", state === "upcoming" ? "text-[var(--ps-smoke)]" : "text-[var(--ps-ink)]")}>{meta.label}</span>
        <span className="ps-caption hidden lg:block">{meta.hint}</span>
      </span>
    </>
  );

  const base = cn("ps-focus relative flex w-full items-center gap-3 rounded-[var(--ps-r-pill)] text-left lg:items-start", clickable ? "cursor-pointer hover:[&_.ps-stepmark]:border-[var(--ps-ink)]" : "cursor-default");

  if (clickable && id === "review" && deckId) {
    return (
      <Link href={`/deck/${deckId}`} className={base} aria-label={`${meta.label}, step ${index + 1}`} aria-current={state === "current" ? "step" : undefined}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={clickable ? onClick : undefined} disabled={!clickable} className={base} aria-label={`${meta.label}, step ${index + 1}`} aria-current={state === "current" ? "step" : undefined}>
      {inner}
    </button>
  );
}
