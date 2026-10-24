"use client";

import { useMemo, useState } from "react";
import { Bell, BellRinging, Check, Flask } from "@phosphor-icons/react";
import { toggleLabsInterest } from "@/lib/labs-interest";
import { useLabsInterest } from "@/hooks/useLabsInterest";
import { AppShell } from "@/components/shell/AppShell";
import { useToast } from "@/components/shell/Toast";
import { PillTabs } from "@/components/ui-kit/PillTabs";
import { LABS_CATEGORIES, LABS_FEATURES } from "./labs-data";

const TABS = LABS_CATEGORIES.map((c) => ({ id: c, label: c }));

/** Presenta Labs at /labs: placeholder previews of upcoming features. "Notify me" only records interest in this browser. */
export function LabsScreen() {
  const { toast } = useToast();
  const interest = useLabsInterest();
  const [category, setCategory] = useState<string>("All");
  const shown = useMemo(() => (category === "All" ? LABS_FEATURES : LABS_FEATURES.filter((f) => f.category === category)), [category]);

  const toggle = (id: string, title: string) => {
    try {
      const next = toggleLabsInterest(id);
      toast(next.includes(id) ? `We will let you know about ${title}.` : `Stopped tracking ${title}.`, { tone: next.includes(id) ? "success" : undefined });
    } catch {
      toast("Could not save that in this browser.");
    }
  };

  return (
    <AppShell active="labs" sidebar="full" breadcrumbs={[{ label: "Studio", href: "/" }, { label: "Labs" }]}>
      <div className="ps-page">
        <header className="ps-labs-hero">
          <span className="ps-labs-badge">
            <Flask size={14} aria-hidden /> Presenta Labs
          </span>
          <h1 className="ps-labs-title">
            The next generation of <span className="ps-accent">presenting</span>
          </h1>
          <p className="ps-body-lg">A look at what we are exploring. These are previews, not features you can use yet. Tell us which ones you want first.</p>
          <p className="ps-caption" aria-live="polite">
            {interest.length ? `You are following ${interest.length} of ${LABS_FEATURES.length} previews.` : "Nothing followed yet."}
          </p>
        </header>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <PillTabs variant="segmented" items={TABS} value={category} onChange={setCategory} ariaLabel="Labs category" />
        </div>

        <ul className="ps-labs-grid" aria-label="Upcoming features">
          {shown.map((f) => {
            const on = interest.includes(f.id);
            return (
              <li key={f.id} id={f.id} className="ps-lab" style={{ "--lab-a": f.tint[0], "--lab-b": f.tint[1] } as React.CSSProperties}>
                <div className="ps-lab-top">
                  <span className="ps-lab-icon" aria-hidden>
                    {f.icon}
                  </span>
                  <span className="ps-lab-stage" data-stage={f.stage}>
                    {f.stage}
                  </span>
                </div>
                <p className="ps-lab-cat">{f.category}</p>
                <h2 className="ps-lab-name">{f.title}</h2>
                <p className="ps-lab-desc">{f.description}</p>
                <button type="button" className="ps-lab-notify" data-on={on ? "true" : undefined} aria-pressed={on} onClick={() => toggle(f.id, f.title)}>
                  {on ? <Check size={14} aria-hidden /> : <Bell size={14} aria-hidden />}
                  {on ? "You will be notified" : "Notify me"}
                  {on ? <BellRinging size={14} className="ps-lab-ring" aria-hidden /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </AppShell>
  );
}
