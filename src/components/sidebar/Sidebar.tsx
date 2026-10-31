"use client";

import { useEffect, type ReactNode } from "react";
import { useAiHealth } from "@/hooks/useAiHealth";
import { cn } from "@/lib/utils";
import { AssistantTab } from "./AssistantTab";
import { DesignTab } from "./DesignTab";
import { useSidebarStore, type SidebarTab } from "./sidebar-store";

export type { SidebarTab } from "./sidebar-store";

export type SidebarProps = {
  /** Which tabs to show, in order. Defaults to Assistant | Design. */
  tabs?: SidebarTab[];
  /** Content of the Details tab (review page). */
  details?: ReactNode;
  /** Initial assistant scope; the review page starts at deck level. */
  defaultScope?: "deck" | "slide" | "element";
  /** Controlled tab; when omitted the shared sidebar store drives it (so the toolbar toggle works). */
  tab?: SidebarTab;
  onTabChange?: (tab: SidebarTab) => void;
  className?: string;
};

const TAB_LABEL: Record<SidebarTab, string> = { assistant: "Assistant", design: "Design", details: "Details" };

/** 340 px taupe panel: the segmented Assistant | Design pill, the AI status tag and one panel (DESIGN.md §7). */
export function Sidebar({ tabs = ["assistant", "design"], details, defaultScope, tab, onTabChange, className }: SidebarProps) {
  const storeTab = useSidebarStore((s) => s.tab);
  const setStoreTab = useSidebarStore((s) => s.setTab);
  const health = useAiHealth();

  const requested = tab ?? storeTab;
  const active: SidebarTab = tabs.includes(requested) ? requested : tabs[0];

  // Keep the shared store on a tab this instance actually shows.
  useEffect(() => {
    if (tab === undefined && !tabs.includes(storeTab)) setStoreTab(tabs[0]);
  }, [tab, tabs, storeTab, setStoreTab]);

  const select = (t: SidebarTab) => {
    onTabChange?.(t);
    if (tab === undefined) setStoreTab(t);
  };

  const state = health ? (health.hasKey ? "claude" : "mock") : "pending";
  const providerName = health?.provider === "presenta" ? "Presenta Studio" : health?.provider === "openai" ? "OpenAI" : health?.provider === "gemini" ? "Gemini" : "Claude";

  return (
    <aside className={cn("ps-sidebar", className)} aria-label="Sidebar">
      <header className="ps-sidebar-header">
        <div className="ps-sb-seg" role="tablist" aria-label="Sidebar panels">
          {tabs.map((t) => (
            <button key={t} type="button" role="tab" id={`ps-tab-${t}`} aria-selected={active === t} aria-controls={`ps-panel-${t}`} onClick={() => select(t)}>
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>
        <span className="ps-sb-status" data-state={state} title={health ? `Model: ${health.model}` : "Checking the AI connection"} aria-live="polite">
          <span className="ps-sb-status-dot" aria-hidden />
          {state === "claude" ? providerName : state === "mock" ? "Offline" : "…"}
        </span>
      </header>
      <div id={`ps-panel-${active}`} role="tabpanel" aria-labelledby={`ps-tab-${active}`} className="flex min-h-0 flex-1 flex-col">
        {active === "assistant" ? <AssistantTab defaultScope={defaultScope} /> : null}
        {active === "design" ? <DesignTab /> : null}
        {active === "details" ? <div className="ps-props">{details}</div> : null}
      </div>
    </aside>
  );
}

