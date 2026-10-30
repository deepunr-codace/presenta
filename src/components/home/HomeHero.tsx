"use client";

import { useRef, useState } from "react";
import { PromptBox, type PromptBoxHandle } from "@/components/shell/PromptBox";
import { STARTERS } from "./starters";

type Props = {
  /** Caption under the prompt; shows the running action while busy. */
  status: string;
  busy: boolean;
  onSubmit: (prompt: string) => void;
  onAgentSubmit: (prompt: string) => void;
};

/** Prompt hero (DESIGN.md §6): the wide prompt card over a drifting aurora, with three starter cards that fill the prompt. */
export function HomeHero({ status, busy, onSubmit, onAgentSubmit }: Props) {
  const [prompt, setPrompt] = useState("");
  const promptRef = useRef<PromptBoxHandle>(null);

  const applyStarter = (text: string) => {
    setPrompt(text);
    requestAnimationFrame(() => promptRef.current?.focus());
  };

  return (
    <section aria-label="Start a deck">
      <div className="ps-home-hero">
        <PromptBox
          ref={promptRef}
          hero
          value={prompt}
          onChange={setPrompt}
          onSubmit={onSubmit}
          onSecondarySubmit={onAgentSubmit}
          placeholder="Describe the deck you need. Topic, audience and goal are a great start…"
          disabled={busy}
          busy={busy}
          autoFocus
        />
      </div>
      <div className="ps-starters" role="group" aria-label="Starter prompts">
        {STARTERS.map((s) => (
          <button key={s.lead} type="button" className="ps-starter" onClick={() => applyStarter(s.prompt)} disabled={busy}>
            <span className="ps-starter-head">
              <span className="ps-starter-icon" aria-hidden>
                {s.icon}
              </span>
              {s.lead}
            </span>
            <p>{s.prompt}</p>
          </button>
        ))}
      </div>
      <p className="ps-caption mt-3 px-1" aria-live="polite">
        {status}
      </p>
    </section>
  );
}
