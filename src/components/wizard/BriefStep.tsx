"use client";

import { ArrowLeft, ChatCircleDots, ClipboardText } from "@phosphor-icons/react";
import { ChatIntake } from "./ChatIntake";
import { OptionCard } from "./OptionCard";
import { PasteIntake } from "./PasteIntake";
import { StepHeader } from "./StepHeader";
import { firstQuestion } from "./chat-stages";
import { useWizardStore, type IntakeMode } from "./wizard-state";

/** Step 1. Entry choice (AI conversation or pasted content), then the chosen intake. "Build outline" moves to step 2. */
export function BriefStep() {
  const mode = useWizardStore((s) => s.mode);
  const setMode = useWizardStore((s) => s.setMode);
  const startChat = useWizardStore((s) => s.startChat);
  const patchBrief = useWizardStore((s) => s.patchBrief);
  const setOutline = useWizardStore((s) => s.setOutline);
  const setStep = useWizardStore((s) => s.setStep);

  const choose = (next: IntakeMode) => {
    if (next === "chat") startChat(firstQuestion());
    else setMode("paste");
  };

  const buildFromChat = () => {
    setOutline(null);
    setStep("outline");
  };

  const buildFromPaste = () => {
    const { paste } = useWizardStore.getState();
    patchBrief({
      source: paste.text.trim().slice(0, 40000),
      audience: paste.audience.trim() || undefined,
      goal: paste.goal.trim() || undefined,
    });
    setOutline(null);
    setStep("outline");
  };

  return (
    <div className="space-y-5">
      <StepHeader title="Brief" hint="Tell us what the deck is for. You can change any of this later." />

      {mode === null ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <OptionCard icon={<ChatCircleDots />} title="Create with AI" body="Answer five quick questions. The assistant suggests answers as you go." cta="Start a conversation" onClick={() => choose("chat")} />
          <OptionCard icon={<ClipboardText />} title="Start from my content" body="Paste notes, an outline or an article, or drop a .txt or .md file." cta="Paste content" onClick={() => choose("paste")} />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <div className="ps-body inline-flex items-center gap-2">
              {mode === "chat" ? <ChatCircleDots size={14} /> : <ClipboardText size={14} />}
              <span className="font-medium text-[var(--ps-ink)]">{mode === "chat" ? "Create with AI" : "Start from my content"}</span>
            </div>
            <button type="button" onClick={() => setMode(null)} className="ps-link inline-flex items-center gap-1 text-[13px]">
              <ArrowLeft size={12} weight="bold" /> Change method
            </button>
          </div>
          {mode === "chat" ? <ChatIntake onBuildOutline={buildFromChat} /> : <PasteIntake onBuildOutline={buildFromPaste} />}
        </>
      )}
    </div>
  );
}
