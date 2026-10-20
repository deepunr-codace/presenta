"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, Folder, House, KeyRound, LayoutGrid, LayoutTemplate, Palette, Plus, Presentation, Trash2, type LucideIcon } from "lucide-react";
import { listDecks, type DeckSummary } from "@/lib/persist";
import { timeAgo } from "@/lib/time";
import { Avatar } from "./Avatar";
import { Mark } from "./Mark";
import { useApiKeyDialog } from "./api-key-dialog-store";
import { ModeToggle } from "./ModeToggle";
import type { NavKey } from "./nav-items";

type Icon = LucideIcon;

type RailItem = { label: string; href?: string; icon: Icon; key?: NavKey; /** Opens a dialog instead of navigating. */ action?: "apikey" };

/** Icon rail (left column): real destinations link, the rest are marked "Soon" and are not navigable. */
const RAIL: RailItem[] = [
  { label: "Home", href: "/", icon: House, key: "home" },
  { label: "Decks", href: "/#decks", icon: LayoutGrid, key: "decks" },
  { label: "Templates", icon: LayoutTemplate },
  { label: "Brand", icon: Palette },
  { label: "API key", icon: KeyRound, action: "apikey" },
];

const RECENT_LIMIT = 5;

export type SideNavProps = {
  active?: NavKey;
  /** `full` = icon rail plus the workspace panel; `rail` = icon rail only (editor, wizard). */
  variant?: "full" | "rail";
};

function RailButton({ item, active }: { item: RailItem; active: boolean }) {
  const openKeyDialog = useApiKeyDialog((s) => s.setOpen);
  const body = (
    <>
      <span className="ps-rail-icon">
        <item.icon size={20} strokeWidth={active ? 2.3 : 1.9} aria-hidden />
      </span>
      <span className="ps-rail-label">{item.label}</span>
    </>
  );
  if (item.action === "apikey") {
    return (
      <button type="button" className="ps-rail-item" title="Add or change your API key" onClick={() => openKeyDialog(true)}>
        {body}
      </button>
    );
  }
  if (!item.href) {
    return (
      <button type="button" className="ps-rail-item" aria-disabled="true" title={`${item.label} (coming soon)`} onClick={(e) => e.preventDefault()}>
        {body}
      </button>
    );
  }
  return (
    <Link href={item.href} className="ps-rail-item" data-active={active ? "true" : undefined} aria-current={active ? "page" : undefined}>
      {body}
    </Link>
  );
}

function PanelRow({ icon: IconC, children, href, active, soon, trailing, onClick }: { icon: Icon; children: ReactNode; href?: string; active?: boolean; soon?: boolean; trailing?: ReactNode; onClick?: () => void }) {
  const inner = (
    <>
      <IconC size={16} aria-hidden />
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {soon ? (
        <span className="ps-pill" data-tone="soon">
          Soon
        </span>
      ) : (
        trailing
      )}
    </>
  );
  if (!href || soon) {
    return (
      <button type="button" className="ps-panel-row" aria-disabled={soon ? "true" : undefined} onClick={(e) => (onClick && !soon ? onClick() : e.preventDefault())}>
        {inner}
      </button>
    );
  }
  return (
    <Link href={href} className="ps-panel-row" data-active={active ? "true" : undefined} aria-current={active ? "page" : undefined}>
      {inner}
    </Link>
  );
}

/** Recent decks from this browser, newest first; reads IndexedDB on mount. */
function RecentDecks() {
  const [decks, setDecks] = useState<DeckSummary[] | null>(null);
  useEffect(() => {
    let alive = true;
    listDecks()
      .then((list) => alive && setDecks(list.slice(0, RECENT_LIMIT)))
      .catch(() => alive && setDecks([]));
    return () => {
      alive = false;
    };
  }, []);

  if (decks === null) return <div className="ps-panel-note">Loading…</div>;
  if (decks.length === 0) return <div className="ps-panel-note">No decks yet. Create your first one.</div>;
  return (
    <ul className="ps-panel-recent" aria-label="Recent decks">
      {decks.map((d) => (
        <li key={d.id}>
          <Link href={`/deck/${d.id}`} className="ps-panel-recent-link" title={d.title || "Untitled deck"}>
            <Presentation size={15} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate">{d.title || "Untitled deck"}</span>
              <span className="ps-panel-sub">{timeAgo(d.updatedAt)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Left sidebar: a 72 px icon rail (logo, destinations, theme toggle, account) and, on the home page,
 * a 264 px workspace panel with Create, recent decks, a folders placeholder and Trash.
 * Hidden under 768 px, where the top nav and its menu sheet take over.
 */
export function SideNav({ active, variant = "full" }: SideNavProps) {
  const full = variant === "full";
  const openKeyDialog = useApiKeyDialog((s) => s.setOpen);
  return (
    <aside className="ps-sidenav" data-variant={variant} aria-label="Sidebar">
      <nav className="ps-rail" aria-label="Primary">
        <Link href="/" className="ps-rail-logo ps-focus" aria-label="Presenta Studio home">
          <Mark size={28} />
        </Link>
        <div className="ps-rail-items">
          {RAIL.map((item) => (
            <RailButton key={item.label} item={item} active={Boolean(item.key) && item.key === active} />
          ))}
        </div>
        <div className="ps-rail-foot">
          <ModeToggle side="right" />
          <Avatar />
        </div>
      </nav>

      {full ? (
        <div className="ps-panel">
          <div className="ps-panel-head">
            <span className="ps-panel-avatar" aria-hidden>
              P
            </span>
            <span className="min-w-0 flex-1">
              <span className="ps-panel-ws">Presenta Workspace</span>
              <span className="ps-panel-sub">Internal</span>
            </span>
            <ChevronDown size={14} strokeWidth={2.2} aria-hidden className="text-[var(--ps-ash)]" />
          </div>

          <div className="ps-panel-group">
            <PanelRow icon={Plus} href="/new" active={active === "new"}>
              Create
            </PanelRow>
            <PanelRow icon={LayoutGrid} href="/#decks">
              All decks
            </PanelRow>
            <PanelRow icon={KeyRound} onClick={() => openKeyDialog(true)}>
              API key
            </PanelRow>
          </div>

          <div className="ps-panel-rule" />
          <p className="ps-panel-kicker">Recent decks</p>
          <RecentDecks />

          <div className="ps-panel-rule" />
          <p className="ps-panel-kicker">Folders</p>
          <div className="ps-panel-folders">
            <div className="ps-panel-ghost" aria-hidden>
              <Folder size={14} />
              <span style={{ width: "72%" }} />
            </div>
            <div className="ps-panel-ghost" aria-hidden>
              <Folder size={14} />
              <span style={{ width: "48%" }} />
            </div>
            <p>Group related decks and share them all at once.</p>
            <span className="ps-panel-soon">Folders are coming soon</span>
          </div>

          <div className="ps-panel-rule" />
          <div className="ps-panel-group">
            <PanelRow icon={Trash2} soon>
              Trash
            </PanelRow>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
