"use client";

import { useState } from "react";
import type { Scope } from "@/lib/assistant/scope";
import { QuickActionPrompt } from "./QuickActionPrompt";
import { actionsForScope, type QuickAction } from "./quick-actions";

export type QuickActionsProps = {
  scope: Scope;
  disabled?: boolean;
  onSend: (instruction: string) => void;
};

/** Row of 24 px chips with scope-specific one-tap instructions. */
export function QuickActions({ scope, disabled, onSend }: QuickActionsProps) {
  const actions = actionsForScope(scope);
  const [active, setActive] = useState<QuickAction | null>(null);

  // Changing scope drops any half-filled prompt.
  const scopeKey = `${scope.kind}:${scope.slideId}:${scope.element?.id ?? ""}`;
  const [seenKey, setSeenKey] = useState(scopeKey);
  if (seenKey !== scopeKey) {
    setSeenKey(scopeKey);
    setActive(null);
  }

  if (actions.length === 0) return null;

  const run = (a: QuickAction) => {
    if (a.instruction) {
      onSend(a.instruction);
      return;
    }
    setActive(a);
  };

  return (
    <>
      <div className="ps-quick" role="group" aria-label="Quick actions">
        {actions.map((a) => (
          <button key={a.label} type="button" className="ps-sb-chip" aria-pressed={active?.label === a.label} disabled={disabled} onClick={() => run(a)}>
            {a.label}
          </button>
        ))}
      </div>
      {active ? (
        <QuickActionPrompt
          key={active.label}
          action={active}
          disabled={disabled}
          onSubmit={(instruction) => {
            onSend(instruction);
            setActive(null);
          }}
          onCancel={() => setActive(null)}
        />
      ) : null}
    </>
  );
}
