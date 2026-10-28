"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react";
import { PRIMARY_BTN, SECONDARY_BTN } from "@/lib/styles";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { StepHeader } from "./StepHeader";
import { useWizardStore } from "./wizard-state";

/** Step 5 lives at /deck/[id]; this shows the finished state. Without a deck it sends the user back to Generate. */
export function ReviewStep() {
  const deckId = useWizardStore((s) => s.deckId);
  const outline = useWizardStore((s) => s.outline);
  const setStep = useWizardStore((s) => s.setStep);
  useEffect(() => {
    if (!deckId) setStep("generate");
  }, [deckId, setStep]);
  if (!deckId) return null;
  return (
    <div className="space-y-5">
      <StepHeader title="Review" hint="Your deck is generated and saved to your account." />
      <section className="ps-glass flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="ps-title truncate">{outline?.title ?? "Your deck"}</p>
          <p className="ps-caption mt-0.5">{outline ? `${outline.slides.length} slides` : "Ready to review"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className={cn(SECONDARY_BTN, "h-9 px-4")} onClick={() => setStep("brand")}>
            <ArrowLeft data-icon="inline-start" /> Regenerate
          </Button>
          <Button className={cn(PRIMARY_BTN, "h-9 px-4")} nativeButton={false} render={<Link href={`/deck/${deckId}`} />}>
            Open review <ArrowRight data-icon="inline-end" weight="bold" />
          </Button>
        </div>
      </section>
    </div>
  );
}
