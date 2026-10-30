"use client";

import { Sparkle } from "@phosphor-icons/react";
import { useAiHealth } from "@/hooks/useAiHealth";
import { useApiKeyDialog } from "@/components/shell/api-key-dialog-store";

/** Which AI is answering, and today's free allowance when it is Presenta Studio. */
export function AiUsageCard() {
  const health = useAiHealth();
  const openKeyDialog = useApiKeyDialog((s) => s.setOpen);
  const quota = health?.quota;
  const left = quota ? Math.max(quota.limit - quota.used, 0) : 0;
  const pct = quota && quota.limit > 0 ? Math.min(100, (quota.used / quota.limit) * 100) : 0;

  const name = !health ? "Checking…" : health.byok ? "Your own API key" : health.provider === "presenta" ? "Presenta Studio" : health.hasKey ? health.model : "Offline demo";
  const note = !health
    ? ""
    : health.byok
      ? "Requests use your own account, with no daily limit from us."
      : health.provider === "presenta"
        ? "Included free with your account."
        : health.hasKey
          ? "Provided by this workspace."
          : "Add an API key to write real decks.";

  return (
    <section className="ps-glass h-full" data-paper aria-labelledby="ai-title">
      <div className="flex items-center gap-2">
        <Sparkle size={20} weight="light" aria-hidden />
        <h2 id="ai-title" className="ps-cardtitle">
          AI
        </h2>
      </div>
      <p className="mt-3 text-[18px] font-medium text-[var(--ps-ink)]">{name}</p>
      <p className="ps-caption">{note}</p>

      {quota && !health?.byok ? (
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-[var(--ps-plate)]" role="progressbar" aria-valuemin={0} aria-valuemax={quota.limit} aria-valuenow={quota.used} aria-label="Free AI requests used today">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 90 ? "var(--ps-danger)" : "var(--ps-ink)" }} />
          </div>
          <p className="ps-caption mt-2">
            {left} of {quota.limit} free requests left today. They reset every day.
          </p>
        </div>
      ) : null}

      <button type="button" className="ps-btn ps-btn-xs mt-4" onClick={() => openKeyDialog(true)}>
        {health?.byok ? "Change my API key" : "Use my own API key"}
      </button>
    </section>
  );
}
