"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { useToast } from "@/components/shell/Toast";
import { ErrorNotice } from "@/components/ui-kit/ErrorNotice";
import { timeAgo } from "@/lib/time";

type PoolKey = {
  id: string;
  label: string;
  hint: string;
  enabled: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  requestCount: number;
  errorCount: number;
  lastError: string | null;
  lastErrorAt: string | null;
  disabledReason: string | null;
  cooldownUntil: string | null;
};
type Settings = { enabled: boolean; model: string; dailyLimit: number };
type State = { keys: PoolKey[]; settings: Settings; usage: { requestsToday: number; usersToday: number } };
type KeyInfo = { ok: boolean; usage: number | null; limit: number | null; remaining: number | null; freeTier: boolean; error?: string };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = (await res.json().catch(() => null)) as ({ error?: string } & T) | null;
  if (!res.ok) throw new Error(body?.error ?? "Something went wrong.");
  return body as T;
}

const usd = (n: number | null) => (n === null ? "no cap" : `$${n.toFixed(2)}`);

function statusOf(k: PoolKey): { label: string; tone: "ok" | "warn" | "off" } {
  if (!k.enabled) return { label: "Off", tone: "off" };
  if (k.cooldownUntil) return { label: "Resting", tone: "warn" };
  return { label: "Active", tone: "ok" };
}

/** /admin/ai: the pool of OpenRouter keys behind "Presenta AI", its model and each customer's daily allowance. */
export function AiAdminScreen() {
  const { toast } = useToast();
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<string, KeyInfo | "loading">>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [adding, setAdding] = useState(false);
  const [model, setModel] = useState("");
  const [limit, setLimit] = useState("");

  const load = useCallback(async () => {
    try {
      const next = await api<State>("/api/admin/ai");
      setState(next);
      setModel(next.settings.model);
      setLimit(String(next.settings.dailyLimit));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the AI settings.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (fn: () => Promise<unknown>, done?: string) => {
    try {
      await fn();
      if (done) toast(done, { tone: "success" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  const addKey = async (e: FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setError(null);
    try {
      await api("/api/admin/ai", { method: "POST", body: JSON.stringify({ label, apiKey }) });
      setLabel("");
      setApiKey("");
      toast("Key added to the pool.", { tone: "success" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the key.");
    } finally {
      setAdding(false);
    }
  };

  const check = async (id: string) => {
    setChecks((c) => ({ ...c, [id]: "loading" }));
    try {
      const { info } = await api<{ info: KeyInfo }>(`/api/admin/ai/keys/${id}`, { method: "POST" });
      setChecks((c) => ({ ...c, [id]: info }));
    } catch (err) {
      setChecks((c) => ({ ...c, [id]: { ok: false, usage: null, limit: null, remaining: null, freeTier: false, error: err instanceof Error ? err.message : "Check failed." } }));
    }
  };

  const settings = state?.settings;
  const settingsDirty = settings && (model.trim() !== settings.model || Number(limit) !== settings.dailyLimit);
  const active = state?.keys.filter((k) => statusOf(k).tone === "ok").length ?? 0;

  return (
    <AppShell breadcrumbs={[{ label: "Studio", href: "/" }, { label: "Admin" }, { label: "Presenta AI" }]}>
      <div className="ps-page ps-page-narrow">
        <header className="mb-8">
          <h1 className="ps-heading">Presenta AI</h1>
          <p className="ps-body-lg mt-2">
            Free AI for your customers, served from a pool of keys. They only ever see &ldquo;Presenta AI&rdquo;. If a key hits its limit, the next one takes over on the same request.
          </p>
        </header>

        {error ? <ErrorNotice compact className="mb-4" message={error} /> : null}
        {!state && !error ? <div className="ps-glass h-40 animate-pulse" aria-hidden /> : null}

        {state && settings ? (
          <div className="flex flex-col gap-4">
            <section className="ps-glass" data-paper>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="ps-cardtitle">Service</h2>
                <span className="ps-pill">{active} of {state.keys.length} keys active</span>
                <span className="ps-pill">{state.usage.requestsToday} requests today · {state.usage.usersToday} customers</span>
                <label className="ml-auto flex items-center gap-2 text-[13px]">
                  <input type="checkbox" checked={settings.enabled} onChange={(e) => void run(() => api("/api/admin/ai", { method: "PUT", body: JSON.stringify({ enabled: e.target.checked }) }), e.target.checked ? "Presenta AI is on." : "Presenta AI is off.")} />
                  Offer Presenta AI to customers
                </label>
              </div>
              <form
                className="ps-auth-form mt-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(() => api("/api/admin/ai", { method: "PUT", body: JSON.stringify({ model: model.trim(), dailyLimit: Number(limit) }) }), "Settings saved.");
                }}
              >
                <div className="ps-auth-field">
                  <label htmlFor="ai-model" className="ps-label">Model</label>
                  <input id="ai-model" className="ps-input" value={model} onChange={(e) => setModel(e.target.value)} placeholder="openai/gpt-4o-mini" />
                  <p className="ps-caption mt-1">An OpenRouter model id. Customers never see it. It must support structured JSON output.</p>
                </div>
                <div className="ps-auth-field">
                  <label htmlFor="ai-limit" className="ps-label">Free requests per customer per day</label>
                  <input id="ai-limit" type="number" min={0} max={10000} className="ps-input" value={limit} onChange={(e) => setLimit(e.target.value)} />
                  <p className="ps-caption mt-1">Generating, outlining and revising count. Answer suggestions are free. Customers who add their own key are not limited.</p>
                </div>
                <div>
                  <button type="submit" className="ps-btn ps-btn-primary ps-btn-xs" disabled={!settingsDirty}>Save settings</button>
                </div>
              </form>
            </section>

            <section className="ps-glass" data-paper>
              <h2 className="ps-cardtitle mb-3">Keys</h2>
              {state.keys.length === 0 ? <p className="ps-body">No keys yet. Add one below, or list them in OPENROUTER_API_KEYS.</p> : null}
              <ul className="flex flex-col gap-3">
                {state.keys.map((k) => {
                  const s = statusOf(k);
                  const info = checks[k.id];
                  return (
                    <li key={k.id} className="rounded-[var(--ps-r-md)] border border-[var(--ps-line)] p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-[14px]">{k.label}</strong>
                        <code className="text-[12px]">…{k.hint}</code>
                        <span className="ps-pill" data-tone={s.tone}>{s.label}</span>
                        <span className="ps-caption ml-auto">{k.requestCount} requests · {k.errorCount} errors · {k.lastUsedAt ? `used ${timeAgo(k.lastUsedAt)}` : "never used"}</span>
                      </div>
                      {k.disabledReason && !k.enabled ? <p className="ps-caption mt-1" style={{ color: "var(--ps-danger)" }}>{k.disabledReason}</p> : null}
                      {k.cooldownUntil ? <p className="ps-caption mt-1">Resting until {new Date(k.cooldownUntil).toLocaleTimeString()} after hitting a limit. Other keys are serving requests meanwhile.</p> : null}
                      {k.lastError && k.enabled && !k.cooldownUntil ? <p className="ps-caption mt-1">Last error {k.lastErrorAt ? timeAgo(k.lastErrorAt) : ""}: {k.lastError}</p> : null}
                      {info === "loading" ? <p className="ps-caption mt-1">Checking with OpenRouter…</p> : null}
                      {info && info !== "loading" ? (
                        <p className="ps-caption mt-1" style={info.ok ? undefined : { color: "var(--ps-danger)" }}>
                          {info.ok ? `Spent ${usd(info.usage)} · cap ${usd(info.limit)} · left ${usd(info.remaining)}${info.freeTier ? " · free tier" : ""}` : info.error}
                        </p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" className="ps-btn ps-btn-xs" onClick={() => void check(k.id)}>Check credit</button>
                        <button type="button" className="ps-btn ps-btn-xs" onClick={() => void run(() => api(`/api/admin/ai/keys/${k.id}`, { method: "PATCH", body: JSON.stringify({ enabled: !k.enabled }) }), k.enabled ? "Key turned off." : "Key turned on.")}>
                          {k.enabled ? "Turn off" : "Turn on"}
                        </button>
                        {confirmDelete === k.id ? (
                          <button type="button" className="ps-btn ps-btn-xs" data-danger="true" onClick={() => void run(() => api(`/api/admin/ai/keys/${k.id}`, { method: "DELETE" }), "Key deleted.").then(() => setConfirmDelete(null))}>
                            Confirm delete
                          </button>
                        ) : (
                          <button type="button" className="ps-btn ps-btn-xs" onClick={() => setConfirmDelete(k.id)}>Delete</button>
                        )}
                      </div>
                      {k.id.startsWith("env_") ? <p className="ps-caption mt-2">Comes from OPENROUTER_API_KEYS. Deleting it here removes it only until the server next restarts; remove it from the env var to retire it.</p> : null}
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="ps-glass" data-paper>
              <h2 className="ps-cardtitle mb-1">Add a key</h2>
              <p className="ps-caption mb-3">The key is checked with OpenRouter, then stored encrypted. It is never shown again or sent to a browser.</p>
              <form className="ps-auth-form" onSubmit={addKey}>
                <div className="ps-auth-field">
                  <label htmlFor="key-label" className="ps-label">Name</label>
                  <input id="key-label" className="ps-input" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} placeholder="Team account 4" required />
                </div>
                <div className="ps-auth-field">
                  <label htmlFor="key-value" className="ps-label">OpenRouter key</label>
                  <input id="key-value" className="ps-input" type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-or-v1-…" required />
                </div>
                <div>
                  <button type="submit" className="ps-btn ps-btn-primary ps-btn-xs" disabled={adding || !label.trim() || !apiKey.trim()}>{adding ? "Checking…" : "Add key"}</button>
                </div>
              </form>
            </section>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
