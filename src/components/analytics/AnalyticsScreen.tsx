"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchAnalytics, type AnalyticsResponse } from "@/lib/drive";
import { timeAgo } from "@/lib/time";
import { StorageMeter } from "@/components/decks/StorageMeter";
import { AppShell } from "@/components/shell/AppShell";
import { ErrorNotice } from "@/components/ui-kit/ErrorNotice";
import { PillTabs } from "@/components/ui-kit/PillTabs";
import { SectionTitle } from "@/components/ui-kit/SectionTitle";

type Range = 7 | 30 | 90;

const RANGES = [
  { id: "7", label: "7 days" },
  { id: "30", label: "30 days" },
  { id: "90", label: "90 days" },
];

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="ps-glass" data-paper>
      <p className="ps-caption">{label}</p>
      <p className="mt-1 text-[28px] leading-8 font-medium text-[var(--ps-ink)]">{value}</p>
      {hint ? <p className="ps-caption mt-1">{hint}</p> : null}
    </div>
  );
}

const short = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });

/** Bars for views (dark) and presentations (grey) per day. Hover or focus a bar for its numbers. */
function DailyChart({ daily }: { daily: AnalyticsResponse["daily"] }) {
  const max = Math.max(1, ...daily.map((d) => d.views + d.presentations));
  const total = daily.reduce((n, d) => n + d.views + d.presentations, 0);
  return (
    <figure>
      <div className="flex h-40 items-end gap-[3px]" role="img" aria-label={`Views and presentations per day. ${total} in total over ${daily.length} days.`}>
        {daily.map((d) => {
          const v = (d.views / max) * 100;
          const p = (d.presentations / max) * 100;
          return (
            <div key={d.day} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${short(d.day)}: ${d.views} ${d.views === 1 ? "view" : "views"}, ${d.presentations} ${d.presentations === 1 ? "presentation" : "presentations"}`}>
              <div className="rounded-t-[2px] bg-[var(--ps-smoke)]" style={{ height: `${p}%`, opacity: 0.55 }} />
              <div className={p ? "" : "rounded-t-[2px]"} style={{ height: `${v}%`, background: "var(--ps-ink)" }} />
              {d.views + d.presentations === 0 ? <div className="h-[2px] rounded-full bg-[var(--ps-line)]" /> : null}
            </div>
          );
        })}
      </div>
      <figcaption className="ps-caption mt-2 flex items-center justify-between gap-3">
        <span>{short(daily[0].day)}</span>
        <span className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block size-2 rounded-sm" style={{ background: "var(--ps-ink)" }} /> Views
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block size-2 rounded-sm bg-[var(--ps-smoke)]" style={{ opacity: 0.55 }} /> Presentations
          </span>
        </span>
        <span>{short(daily[daily.length - 1].day)}</span>
      </figcaption>
    </figure>
  );
}

/** /analytics: how my decks are being opened and presented, and how full my storage is. */
export function AnalyticsScreen() {
  const [range, setRange] = useState<Range>(30);
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<Range | null>(null);

  useEffect(() => {
    let alive = true;
    fetchAnalytics(range)
      .then((d) => {
        if (!alive) return;
        setData(d);
        setLoadedFor(range);
        setError(null);
      })
      .catch((err: unknown) => alive && setError(err instanceof Error ? err.message : "Could not load analytics."));
    return () => {
      alive = false;
    };
  }, [range]);

  const loading = loadedFor !== range && !error;
  const t = data?.totals;
  const empty = useMemo(() => Boolean(t && t.views === 0 && t.presentations === 0), [t]);

  return (
    <AppShell active="analytics" sidebar="full" breadcrumbs={[{ label: "Studio", href: "/" }, { label: "Analytics" }]}>
      <div className="ps-page">
        <header className="ps-page-hero mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="ps-heading">Analytics</h1>
            <p className="ps-body-lg mt-2">See who opens and presents your decks.</p>
          </div>
          <PillTabs variant="segmented" ariaLabel="Time range" items={RANGES} value={String(range)} onChange={(id) => setRange(Number(id) as Range)} />
        </header>

        {error ? <ErrorNotice compact className="mb-4" message={error} /> : null}
        {!data && !error ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-hidden>{[0, 1, 2, 3].map((i) => <div key={i} className="ps-glass h-28 animate-pulse" />)}</div> : null}

        {data && t ? (
          <div className="flex flex-col gap-8" style={{ opacity: loading ? 0.6 : 1 }} aria-busy={loading}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Tile label="Views by others" value={t.viewsByOthers.toLocaleString()} hint={`${t.views.toLocaleString()} including yours`} />
              <Tile label="People who viewed" value={t.uniqueViewers.toLocaleString()} hint="Other than you" />
              <Tile label="Presentations" value={t.presentations.toLocaleString()} />
              <Tile label="Decks shared" value={`${t.sharedDecks} of ${t.decks}`} hint={`${t.slides.toLocaleString()} slides in total`} />
            </div>

            <section className="ps-glass" data-paper aria-labelledby="activity-title">
              <SectionTitle title={<span id="activity-title">Activity</span>} caption={`Last ${data.days} days`} className="mb-4" />
              <DailyChart daily={data.daily} />
              {empty ? (
                <p className="ps-body mt-4">
                  Nothing opened yet in this period. A view is counted when someone opens a deck&apos;s review page, and a presentation when they start presenting. Share a deck from the{" "}
                  <Link href="/decks" className="ps-link">
                    Decks page
                  </Link>{" "}
                  to see activity here.
                </p>
              ) : null}
            </section>

            <section aria-labelledby="by-deck-title">
              <SectionTitle title={<span id="by-deck-title">By deck</span>} caption="Most viewed by others first" className="mb-4" />
              {data.decks.length === 0 ? (
                <p className="ps-body">You have no decks yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-[var(--ps-r-md)] border border-[var(--ps-line)]">
                  <table className="w-full min-w-[640px] text-left text-[13px]">
                    <thead className="ps-caption bg-[var(--ps-plate)]">
                      <tr>
                        <th className="px-3 py-2 font-medium">Deck</th>
                        <th className="px-3 py-2 font-medium">Views by others</th>
                        <th className="px-3 py-2 font-medium">Viewers</th>
                        <th className="px-3 py-2 font-medium">Presented</th>
                        <th className="px-3 py-2 font-medium">Shared with</th>
                        <th className="px-3 py-2 font-medium">Last viewed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.decks.map((d) => (
                        <tr key={d.id} className="border-t border-[var(--ps-line)]">
                          <td className="max-w-[260px] truncate px-3 py-2">
                            <Link href={`/deck/${encodeURIComponent(d.id)}`} className="ps-link">
                              {d.title || "Untitled deck"}
                            </Link>
                          </td>
                          <td className="px-3 py-2">{d.viewsByOthers}</td>
                          <td className="px-3 py-2">{d.uniqueViewers}</td>
                          <td className="px-3 py-2">{d.presentations}</td>
                          <td className="px-3 py-2">{d.people ? `${d.people} ${d.people === 1 ? "share" : "shares"}` : "—"}</td>
                          <td className="px-3 py-2">{d.lastViewedAt ? timeAgo(d.lastViewedAt) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="ps-glass" data-paper aria-labelledby="storage-title">
              <SectionTitle title={<span id="storage-title">Storage</span>} className="mb-3" />
              <StorageMeter used={data.storage.used} limit={data.storage.limit} />
              <Link href="/account#storage" className="ps-btn ps-btn-xs mt-3 inline-flex">
                See what is using it
              </Link>
            </section>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
