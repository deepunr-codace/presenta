"use client";

import { useRef, useState } from "react";
import { PromptBox, type PromptBoxHandle } from "@/components/shell/PromptBox";
import { STARTERS } from "./starters";

type Props = {
  /** Caption under the prompt; shows the running action while busy. */
  status: string;
  busy: boolean;
  onSubmit: (prompt: string) => void;
};

/** Prompt hero (DESIGN.md §6): the wide taupe prompt card with three starter chips and a filled "Create deck" pill. */
export function HomeHero({ status, busy, onSubmit }: Props) {
  const [prompt, setPrompt] = useState("");
  const promptRef = useRef<PromptBoxHandle>(null);

  const applyStarter = (text: string) => {
    setPrompt(text);
    requestAnimationFrame(() => promptRef.current?.focus());
  };

  return (
    <section aria-label="Start a deck">
      <PromptBox
        ref={promptRef}
        hero
        value={prompt}
        onChange={setPrompt}
        onSubmit={onSubmit}
        placeholder="Describe the deck you need. Topic, audience and goal are a great start…"
        disabled={busy}
        busy={busy}
        autoFocus
        starters={
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="ps-caption mr-1">Try</span>
            {STARTERS.map((s) => (
              <button key={s.lead} type="button" className="ps-chip" onClick={() => applyStarter(s.prompt)} disabled={busy}>
                {s.icon}
                {s.lead}
              </button>
            ))}
          </div>
        }
      />
      <p className="ps-caption mt-3 px-1" aria-live="polite">
        {status}
      </p>
    </section>
  );
}
