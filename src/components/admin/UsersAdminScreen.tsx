"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { AdminNav } from "@/components/admin/AdminNav";
import { AppShell } from "@/components/shell/AppShell";
import { ErrorNotice } from "@/components/ui-kit/ErrorNotice";
import { formatBytes } from "@/lib/media";
import { timeAgo } from "@/lib/time";

type User = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  signIn: "password" | "oauth";
  createdAt: string;
  lastActiveAt: string | null;
  decks: number;
  trashedDecks: number;
  slides: number;
  deckBytes: number;
  media: number;
  mediaBytes: number;
  aiToday: number;
  ai30d: number;
  aiTotal: number;
  views: number;
  presentations: number;
  sharedDecks: number;
  teams: number;
};
type Detail = {
  decks: { id: string; title: string; slides: number; bytes: number; updatedAt: string; trashed: boolean; views: number }[];
  aiDaily: { day: string; count: number }[];
};

type Provider = "openai" | "anthropic" | "gemini";
type AssignedKey = { provider: Provider; hint: string; setBy: string; updatedAt: string };
const PROVIDERS: { id: Provider; label: string }[] = [
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic" },
  { id: "gemini", label: "Gemini" },
];

/** The AI keys assigned to one user: set, replace or remove a key per provider. The key itself is never shown again. */
function UserKeys({ id }: { id: string }) {
  const [keys, setKeys] = useState<AssignedKey[] | null>(null);
  const [drafts, setDrafts] = useState<Record<Provider, string>>({ openai: "", anthropic: "", gemini: "" });
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/admin/users/${encodeURIComponent(id)}/keys`)
      .then(async (r) => {
        const body = (await r.json().catch(() => null)) as { keys?: AssignedKey[]; error?: string } | null;
        if (!r.ok || !body?.keys) throw new Error(body?.error ?? "Could not load the keys.");
        if (live) setKeys(body.keys);
      })
      .catch((err: unknown) => live && setError(err instanceof Error ? err.message : "Could not load the keys."));
    return () => {
      live = false;
    };
  }, [id]);

  const call = async (provider: Provider, method: "PUT" | "DELETE", body: Record<string, string>) => {
    setBusy(provider);
    setError(null);
    try {
      const r = await fetch(`/api/admin/users/${encodeURIComponent(id)}/keys`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, ...body }) });
      const res = (await r.json().catch(() => null)) as { keys?: AssignedKey[]; error?: string } | null;
      if (!r.ok || !res?.keys) throw new Error(res?.error ?? "Something went wrong.");
      setKeys(res.keys);
      setDrafts((d) => ({ ...d, [provider]: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <p className="ps-caption mb-2">AI keys for this user</p>
      <p className="ps-caption mb-3">A key set here serves this person&apos;s AI requests instead of Presenta Studio, with no daily limit. They see which provider is in use, never the key. OpenAI is used first when several are set.</p>
      {error ? <ErrorNotice compact className="mb-2" message={error} /> : null}
      <div className="flex flex-col gap-2">
        {PROVIDERS.map((p) => {
          const set = keys?.find((k) => k.provider === p.id);
          return (
            <div key={p.id} className="ps-control-row">
              <input
                className="ps-input"
                type="password"
                autoComplete="off"
                value={drafts[p.id]}
                onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                placeholder={set ? `${p.label} · set by ${set.setBy} · …${set.hint} (paste a new key to replace)` : `${p.label} key`}
                aria-label={`${p.label} key for this user`}
                disabled={keys === null}
              />
              <button type="button" className="ps-btn ps-btn-primary" disabled={busy !== null || !drafts[p.id].trim()} onClick={() => void call(p.id, "PUT", { apiKey: drafts[p.id].trim() })}>
                {busy === p.id ? "Saving…" : set ? "Replace" : "Set"}
              </button>
              <button type="button" className="ps-btn" data-danger={set ? "true" : undefined} disabled={!set || busy !== null} onClick={() => void call(p.id, "DELETE", {})}>
                Remove
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type SortKey = "joined" | "active" | "decks" | "storage" | "ai30d" | "views";
const SORTS: { id: SortKey; label: string }[] = [
  { id: "active", label: "Last active" },
  { id: "joined", label: "Newest" },
  { id: "decks", label: "Most decks" },
  { id: "storage", label: "Most storage" },
  { id: "ai30d", label: "Most AI use (30 days)" },
  { id: "views", label: "Most views" },
];

const time = (v: string | null) => (v ? new Date(v).getTime() : 0);
const storageOf = (u: User) => u.deckBytes + u.mediaBytes;
const SORT_VALUE: Record<SortKey, (u: User) => number> = {
  joined: (u) => time(u.createdAt),
  active: (u) => time(u.lastActiveAt),
  decks: (u) => u.decks,
  storage: storageOf,
  ai30d: (u) => u.ai30d,
  views: (u) => u.views,
};
const DAY = 24 * 60 * 60 * 1000;

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="ps-glass" data-paper>
      <p className="ps-caption">{label}</p>
      <p className="mt-1 text-[28px] leading-8 font-medium text-[var(--ps-ink)]">{value}</p>
      {hint ? <p className="ps-caption mt-1">{hint}</p> : null}
    </div>
  );
}

function csvCell(v: string | number | null): string {
  const s = v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(users: User[]) {
  const head = ["Name", "Email", "Sign-in", "Joined", "Last active", "Decks", "Trashed decks", "Slides", "Deck storage (bytes)", "Media files", "Media storage (bytes)", "AI today", "AI 30 days", "AI total", "Views", "Presentations", "Shared decks", "Teams"];
  const rows = users.map((u) => [u.name, u.email, u.signIn, u.createdAt, u.lastActiveAt, u.decks, u.trashedDecks, u.slides, u.deckBytes, u.media, u.mediaBytes, u.aiToday, u.ai30d, u.aiTotal, u.views, u.presentations, u.sharedDecks, u.teams]);
  const text = [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `presenta-users-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Bars for the last 30 days of AI requests. */
function AiBars({ daily, now }: { daily: Detail["aiDaily"]; now: number }) {
  const byDay = new Map(daily.map((d) => [d.day, d.count]));
  const days = Array.from({ length: 30 }, (_, i) => new Date(now - (29 - i) * DAY).toISOString().slice(0, 10));
  const max = Math.max(1, ...daily.map((d) => d.count));
  return (
    <div className="flex h-16 items-end gap-[3px]" role="img" aria-label={`AI requests over the last 30 days: ${daily.reduce((n, d) => n + d.count, 0)} in total`}>
      {days.map((d) => {
        const n = byDay.get(d) ?? 0;
        return <span key={d} title={`${d}: ${n}`} className="flex-1 rounded-sm bg-[var(--ps-ink)]" style={{ height: `${Math.max(n ? 8 : 2, (n / max) * 100)}%`, opacity: n ? 0.85 : 0.15 }} />;
      })}
    </div>
  );
}

function UserDetail({ id }: { id: string }) {
  const [detail, setDetail] = useState<(Detail & { at: number }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/admin/users/${encodeURIComponent(id)}`)
      .then(async (r) => {
        const body = (await r.json().catch(() => null)) as (Detail & { error?: string }) | null;
        if (!r.ok || !body) throw new Error(body?.error ?? "Could not load this user.");
        if (live) setDetail({ ...body, at: Date.now() });
      })
      .catch((err: unknown) => live && setError(err instanceof Error ? err.message : "Could not load this user."));
    return () => {
      live = false;
    };
  }, [id]);

  if (error) return <ErrorNotice compact message={error} />;
  if (!detail) return <p className="ps-caption">Loading…</p>;
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div>
        <p className="ps-caption mb-2">Decks ({detail.decks.length})</p>
        {detail.decks.length === 0 ? (
          <p className="ps-body">No decks yet.</p>
        ) : (
          <ul className="flex max-h-60 flex-col gap-1 overflow-y-auto">
            {detail.decks.map((d) => (
              <li key={d.id} className="flex items-center gap-3 text-[13px]">
                <span className="min-w-0 flex-1 truncate">{d.title || "Untitled deck"}</span>
                {d.trashed ? <span className="ps-pill" data-tone="off">Trash</span> : null}
                <span className="ps-caption whitespace-nowrap">
                  {d.slides} slides · {formatBytes(d.bytes)} · {d.views} views · {timeAgo(d.updatedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <p className="ps-caption mb-2">AI requests, last 30 days</p>
        <AiBars daily={detail.aiDaily} now={detail.at} />
      </div>
      <div className="lg:col-span-2">
        <UserKeys id={id} />
      </div>
    </div>
  );
}

async function fetchUsers(): Promise<{ users: User[]; limit: number; at: number }> {
  const res = await fetch("/api/admin/users");
  const body = (await res.json().catch(() => null)) as { users?: User[]; storageLimit?: number; error?: string } | null;
  if (!res.ok || !body?.users) throw new Error(body?.error ?? "Could not load the users.");
  return { users: body.users, limit: body.storageLimit ?? 0, at: Date.now() };
}

/** /admin/users: every account, what it stores and how much it uses the app. */
export function UsersAdminScreen() {
  const [data, setData] = useState<{ users: User[]; limit: number; at: number } | null>(null);
  const users = data?.users ?? null;
  const limit = data?.limit ?? 0;
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("active");
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(
    () =>
      fetchUsers().then(
        (next) => {
          setData(next);
          setError(null);
        },
        (err: unknown) => setError(err instanceof Error ? err.message : "Could not load the users."),
      ),
    [],
  );

  useEffect(() => {
    let live = true;
    fetchUsers().then(
      (next) => live && setData(next),
      (err: unknown) => live && setError(err instanceof Error ? err.message : "Could not load the users."),
    );
    return () => {
      live = false;
    };
  }, []);

  const shown = useMemo(() => {
    if (!users) return [];
    const q = query.trim().toLowerCase();
    const list = q ? users.filter((u) => u.email.toLowerCase().includes(q) || (u.name ?? "").toLowerCase().includes(q)) : users;
    const value = SORT_VALUE[sort];
    return [...list].sort((a, b) => value(b) - value(a));
  }, [users, query, sort]);

  const totals = useMemo(() => {
    const all = data?.users ?? [];
    const now = data?.at ?? 0;
    return {
      users: all.length,
      active7: all.filter((u) => u.lastActiveAt && now - time(u.lastActiveAt) < 7 * DAY).length,
      new7: all.filter((u) => now - time(u.createdAt) < 7 * DAY).length,
      decks: all.reduce((n, u) => n + u.decks, 0),
      slides: all.reduce((n, u) => n + u.slides, 0),
      aiToday: all.reduce((n, u) => n + u.aiToday, 0),
      ai30d: all.reduce((n, u) => n + u.ai30d, 0),
      storage: all.reduce((n, u) => n + storageOf(u), 0),
    };
  }, [data]);

  return (
    <AppShell breadcrumbs={[{ label: "Studio", href: "/" }, { label: "Admin" }, { label: "Users" }]}>
      <div className="ps-page">
        <header className="ps-page-hero mb-6">
          <h1 className="ps-heading">Users</h1>
          <p className="ps-body-lg mt-2">Every account, what it stores and how much it uses Presenta.</p>
        </header>
        <AdminNav current="/admin/users" />

        {error ? <ErrorNotice compact className="mb-4" message={error} /> : null}
        {!users && !error ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-hidden>{[0, 1, 2, 3].map((i) => <div key={i} className="ps-glass h-28 animate-pulse" />)}</div> : null}

        {users ? (
          <div className="flex flex-col gap-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Tile label="Accounts" value={totals.users.toLocaleString()} hint={`${totals.new7} joined in the last 7 days`} />
              <Tile label="Active in the last 7 days" value={totals.active7.toLocaleString()} hint={totals.users ? `${Math.round((totals.active7 / totals.users) * 100)}% of accounts` : undefined} />
              <Tile label="AI requests" value={totals.ai30d.toLocaleString()} hint={`Last 30 days · ${totals.aiToday} today`} />
              <Tile label="Decks" value={totals.decks.toLocaleString()} hint={`${totals.slides.toLocaleString()} slides · ${formatBytes(totals.storage)} stored`} />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label htmlFor="user-search" className="sr-only">Search users</label>
              <input id="user-search" className="ps-input max-w-[320px] flex-1" type="search" placeholder="Search by name or email" value={query} onChange={(e) => setQuery(e.target.value)} />
              <label htmlFor="user-sort" className="sr-only">Sort users</label>
              <select id="user-sort" className="ps-input w-auto" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                {SORTS.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
              <span className="ps-caption">{shown.length === users.length ? `${users.length} accounts` : `${shown.length} of ${users.length}`}</span>
              <div className="ml-auto flex gap-2">
                <button type="button" className="ps-btn ps-btn-xs" onClick={() => void load()}>Refresh</button>
                <button type="button" className="ps-btn ps-btn-xs" onClick={() => downloadCsv(shown)} disabled={!shown.length}>Export CSV</button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-[var(--ps-r-md)] border border-[var(--ps-line)]">
              <table className="w-full min-w-[980px] text-left text-[13px]">
                <thead className="ps-caption bg-[var(--ps-plate)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">User</th>
                    <th className="px-3 py-2 font-medium">Joined</th>
                    <th className="px-3 py-2 font-medium">Last active</th>
                    <th className="px-3 py-2 font-medium">Decks</th>
                    <th className="px-3 py-2 font-medium">Storage</th>
                    <th className="px-3 py-2 font-medium">AI today / 30d / total</th>
                    <th className="px-3 py-2 font-medium">Views</th>
                    <th className="px-3 py-2 font-medium">Presented</th>
                    <th className="px-3 py-2 font-medium">Shared · Teams</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((u) => {
                    const expanded = open === u.id;
                    const used = storageOf(u);
                    const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
                    return (
                      <Fragment key={u.id}>
                        <tr className="cursor-pointer border-t border-[var(--ps-line)] hover:bg-[var(--ps-plate)]" onClick={() => setOpen(expanded ? null : u.id)}>
                          <td className="px-3 py-2">
                            <button type="button" className="flex max-w-[260px] items-center gap-2 text-left" aria-expanded={expanded} onClick={(e) => { e.stopPropagation(); setOpen(expanded ? null : u.id); }}>
                              <span className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--ps-plate)] text-[12px] font-medium" aria-hidden>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                {u.image ? <img src={u.image} alt="" className="size-full object-cover" /> : (u.name || u.email).charAt(0).toUpperCase()}
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate font-medium text-[var(--ps-ink)]">{u.name || u.email.split("@")[0]}</span>
                                <span className="ps-caption block truncate">{u.email}{u.signIn === "oauth" ? " · Google" : ""}</span>
                              </span>
                            </button>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap" title={new Date(u.createdAt).toLocaleString()}>{new Date(u.createdAt).toLocaleDateString()}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{u.lastActiveAt ? timeAgo(u.lastActiveAt) : "Never"}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {u.decks} <span className="ps-caption">· {u.slides} slides{u.trashedDecks ? ` · ${u.trashedDecks} in trash` : ""}</span>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap" title={`Decks ${formatBytes(u.deckBytes)} · ${u.media} media files ${formatBytes(u.mediaBytes)}`}>
                            {formatBytes(used)}
                            {limit ? (
                              <span className="mt-1 block h-1 w-20 overflow-hidden rounded-full bg-[var(--ps-plate)]">
                                <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: pct > 90 ? "var(--ps-danger)" : "var(--ps-ink)" }} />
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">{u.aiToday} / {u.ai30d} / {u.aiTotal}</td>
                          <td className="px-3 py-2">{u.views}</td>
                          <td className="px-3 py-2">{u.presentations}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{u.sharedDecks} · {u.teams}</td>
                        </tr>
                        {expanded ? (
                          <tr className="bg-[var(--ps-plate)]/40">
                            <td colSpan={9} className="px-4 py-4">
                              <UserDetail id={u.id} />
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                  {shown.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-3 py-6 text-center ps-caption">No accounts match &ldquo;{query}&rdquo;.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <p className="ps-caption">
              Last active is the latest deck save, upload, AI request, view or presentation. AI counts Presenta Studio requests only; people using their own key are not counted. Click a row for that person&apos;s decks and daily AI use.
            </p>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
