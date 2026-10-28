"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  ArrowRight,
  ChartLine,
  ChevronRight,
  Ellipsis,
  FlaskConical,
  Folder,
  House,
  Images,
  KeyRound,
  Keyboard,
  LayoutGrid,
  LayoutTemplate,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Plug,
  Plus,
  Presentation,
  Search,
  Share2,
  Star,
  Trash2,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { LABS_FEATURES, LABS_HIGHLIGHTS } from "@/components/labs/labs-data";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAiHealth } from "@/hooks/useAiHealth";
import { useDecks } from "@/hooks/useDecks";
import { useDayPart } from "@/components/home/useDayPart";
import { useIsMac, useStarred } from "@/hooks/useStarred";
import type { DeckSummary } from "@/lib/persist";
import { timeAgo } from "@/lib/time";
import { Avatar } from "./Avatar";
import { Mark } from "./Mark";
import { useApiKeyDialog } from "./api-key-dialog-store";
import { ModeToggle } from "./ModeToggle";
import type { NavKey } from "./nav-items";
import { useOverlays } from "./overlay-store";

type Icon = LucideIcon;

type RailItem = { label: string; href?: string; icon: Icon; key?: NavKey; /** Opens a dialog instead of navigating. */ action?: "apikey" | "search"; /** Shows a small "new" dot. */ isNew?: boolean };

/** Icon rail (left column): the everyday destinations. Search comes first so it is one click away on every screen, including the editor. The rest live under More. */
const RAIL: RailItem[] = [
  { label: "Search", icon: Search, action: "search" },
  { label: "Home", href: "/", icon: House, key: "home" },
  { label: "Decks", href: "/decks", icon: LayoutGrid, key: "decks" },
  { label: "Templates", href: "/templates", icon: LayoutTemplate, key: "templates" },
  { label: "Media", href: "/media", icon: Images, key: "media" },
  { label: "Teams", href: "/teams", icon: UsersRound, key: "teams" },
  { label: "Brand", href: "/brand", icon: Palette, key: "brand" },
];

/** Destinations in the More menu. A `key` makes the More icon show as active while that page is open. */
const MORE_KEYS: NavKey[] = ["trash"];

const RECENT_LIMIT = 5;
const STARRED_LIMIT = 5;

/* ---------- panel open or closed (kept in this browser) ---------- */

const PANEL_CLOSED_KEY = "presenta:sidebar-panel-closed";
const PANEL_EVENT = "presenta:sidebar-panel-changed";

function subscribePanel(onChange: () => void): () => void {
  window.addEventListener(PANEL_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(PANEL_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readPanelClosed(): boolean {
  try {
    return window.localStorage.getItem(PANEL_CLOSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writePanelClosed(closed: boolean): void {
  try {
    window.localStorage.setItem(PANEL_CLOSED_KEY, closed ? "1" : "0");
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(PANEL_EVENT));
}

export type SideNavProps = {
  active?: NavKey;
  /** `full` = icon rail plus the workspace panel; `rail` = icon rail only. */
  variant?: "full" | "rail";
  /** The panel exists but starts closed (the editor): it opens from the rail icon, without touching the saved state. */
  startCollapsed?: boolean;
};

function RailButton({ item, active }: { item: RailItem; active: boolean }) {
  const openKeyDialog = useApiKeyDialog((s) => s.setOpen);
  const setSearch = useOverlays((s) => s.setSearch);
  const body = (
    <>
      <span className="ps-rail-icon">
        <item.icon size={21} strokeWidth={active ? 2 : 1.75} aria-hidden />
        {item.isNew ? <span className="ps-rail-new" aria-label="New" /> : null}
      </span>
      <span className="ps-rail-label">{item.label}</span>
    </>
  );
  if (item.action) {
    const onClick = item.action === "search" ? () => setSearch(true) : () => openKeyDialog(true);
    const title = item.action === "search" ? "Search decks, pages and templates" : "Add or change your API key";
    return (
      <button type="button" className="ps-rail-item" title={title} onClick={onClick}>
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

/** The More icon: a menu with the less-used destinations and settings (the standard "overflow" pattern). */
function RailMore({ active }: { active?: NavKey }) {
  const router = useRouter();
  const openKeyDialog = useApiKeyDialog((s) => s.setOpen);
  const setShortcuts = useOverlays((s) => s.setShortcuts);
  const current = active !== undefined && MORE_KEYS.includes(active);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<button type="button" className="ps-rail-item" data-active={current ? "true" : undefined} aria-label="More" title="More" />}
      >
        <span className="ps-rail-icon">
          <Ellipsis size={21} strokeWidth={2} aria-hidden />
        </span>
        <span className="ps-rail-label">More</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" sideOffset={12} className="ps-more-menu w-60">
        <DropdownMenuItem onClick={() => router.push("/trash")}>
          <Trash2 /> Trash
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setShortcuts(true)}>
          <Keyboard /> Keyboard shortcuts
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openKeyDialog(true)}>
          <KeyRound /> API key
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PanelRow({ icon: IconC, children, href, active, soon, trailing, onClick }: { icon: Icon; children: ReactNode; href?: string; active?: boolean; soon?: boolean; trailing?: ReactNode; onClick?: () => void }) {
  const inner = (
    <>
      <IconC size={16} strokeWidth={active ? 2 : 1.75} aria-hidden />
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

/** A deck link in the panel: title and age. */
function DeckLink({ deck, icon: IconC }: { deck: DeckSummary; icon: Icon }) {
  return (
    <li>
      <Link href={`/deck/${deck.id}`} className="ps-panel-recent-link" title={deck.title || "Untitled deck"}>
        <IconC size={15} strokeWidth={1.75} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate">{deck.title || "Untitled deck"}</span>
          <span className="ps-panel-sub">{timeAgo(deck.updatedAt)}</span>
        </span>
      </Link>
    </li>
  );
}

/** Starred and recent decks from this browser; reads IndexedDB on mount. */
function DeckLists() {
  const decks = useDecks();
  const starredIds = useStarred();

  const starred = (decks ?? []).filter((d) => starredIds.includes(d.id)).slice(0, STARRED_LIMIT);
  const recent = (decks ?? []).slice(0, RECENT_LIMIT);

  return (
    <>
      {starred.length ? (
        <>
          <p className="ps-panel-kicker">Starred</p>
          <ul className="ps-panel-recent" aria-label="Starred decks">
            {starred.map((d) => (
              <DeckLink key={d.id} deck={d} icon={Star} />
            ))}
          </ul>
          <div className="ps-panel-rule" />
        </>
      ) : null}
      <p className="ps-panel-kicker">Recent decks</p>
      {decks === null ? (
        <div className="ps-panel-note">Loading…</div>
      ) : recent.length === 0 ? (
        <div className="ps-panel-note">No decks yet. Create your first one.</div>
      ) : (
        <ul className="ps-panel-recent" aria-label="Recent decks">
          {recent.map((d) => (
            <DeckLink key={d.id} deck={d} icon={Presentation} />
          ))}
        </ul>
      )}
    </>
  );
}

/** The panel's header: a greeting for the time of day, the workspace name and the button that closes the panel. */
function WorkspaceCard({ onClose, mod }: { onClose: () => void; mod: string }) {
  const part = useDayPart();
  return (
    <section className="ps-ws" aria-label="Workspace">
      <span className="ps-ws-orb" aria-hidden>
        <span>P</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="ps-ws-hello">Presenta</span>
        <span className="ps-panel-sub">Good {part ?? "day"}</span>
      </span>
      <button type="button" className="ps-panel-close" aria-label="Close sidebar panel" aria-expanded title={`Close sidebar (${mod}+B)`} onClick={onClose}>
        <PanelLeftClose size={16} strokeWidth={1.75} aria-hidden />
      </button>
    </section>
  );
}

/** Which AI is answering and how to change it; opens the API key dialog. */
function AiStatus() {
  const health = useAiHealth();
  const openKeyDialog = useApiKeyDialog((s) => s.setOpen);
  const provider = health ? (health.provider === "presenta" ? "Presenta AI" : health.provider === "openai" ? "OpenAI" : health.provider === "claude" ? "Claude" : "Offline demo") : "Checking…";
  const live = Boolean(health?.hasKey);
  // The free daily allowance as a bar: full when nothing is used, and it turns amber, then red, as it runs out.
  const quota = health?.quota && !health.byok ? health.quota : null;
  const left = quota ? Math.max(quota.limit - quota.used, 0) : 0;
  const pct = quota && quota.limit > 0 ? (left / quota.limit) * 100 : 0;
  const tone = !health ? "idle" : !live ? "off" : quota ? (pct <= 15 ? "low" : pct <= 40 ? "mid" : "ok") : "ok";
  const hint = !live ? "Add a key for real decks" : health?.byok ? `Your key · ${health.model}` : "Included with your account";
  return (
    <button type="button" className="ps-panel-ai" data-tone={tone} onClick={() => openKeyDialog(true)} title={live ? "Change the AI, or use your own key" : "Add an API key"} aria-label={`AI: ${provider}${quota ? `, ${left} of ${quota.limit} free requests left today` : ""}. Open API key settings`}>
      <span className="ps-ai-head">
        <span className="ps-panel-ai-dot" data-live={live ? "true" : undefined} aria-hidden />
        <span className="ps-panel-ai-name">{provider}</span>
        <ChevronRight size={12} strokeWidth={2} className="ps-ai-go" aria-hidden />
      </span>
      {quota ? (
        <>
          <span className="ps-ai-bar" role="progressbar" aria-valuemin={0} aria-valuemax={quota.limit} aria-valuenow={left} aria-label="Free requests left today">
            <span style={{ width: `${Math.max(pct, left > 0 ? 3 : 0)}%` }} />
          </span>
          <span className="ps-ai-meta">
            <strong>{left}</strong> of {quota.limit} free requests left today
          </span>
        </>
      ) : (
        <span className="ps-ai-meta">{hint}</span>
      )}
    </button>
  );
}

/**
 * Left sidebar: a 68 px icon rail (search, destinations, theme toggle, account) and, on the home page, a 224 px
 * workspace panel: New deck, starred and recent decks, a workspace group (shared decks, teams, folders, analytics,
 * integrations), the Labs card and, fixed at the bottom, the AI status. Each destination
 * appears once: the rail has the global ones, More has Trash, shortcuts and the API key. Hidden under 768 px, where
 * the top nav and its menu sheet take over.
 */
export function SideNav({ active, variant = "full", startCollapsed = false }: SideNavProps) {
  const full = variant === "full";
  const mod = useIsMac() ? "⌘" : "Ctrl";
  const closed = useSyncExternalStore(subscribePanel, readPanelClosed, () => false);
  // Pages that start collapsed (the editor) keep their own open state so they never change the saved preference.
  const [localOpen, setLocalOpen] = useState(false);
  const panelOpen = startCollapsed ? localOpen : !closed;
  const openPanel = () => (startCollapsed ? setLocalOpen(true) : writePanelClosed(false));
  const closePanel = () => (startCollapsed ? setLocalOpen(false) : writePanelClosed(true));

  // Cmd/Ctrl+B shows or hides the panel on pages that have one (not the editor, where it means bold).
  useEffect(() => {
    if (!full || startCollapsed) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        writePanelClosed(!readPanelClosed());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full, startCollapsed]);

  return (
    <aside className="ps-sidenav" data-variant={variant} aria-label="Sidebar">
      <nav className="ps-rail" aria-label="Primary">
        <Link href="/" className="ps-rail-logo ps-focus" aria-label="Presenta Studio home">
          <Mark size={36} />
        </Link>
        {full && !panelOpen ? (
          <button type="button" className="ps-rail-expand" aria-label="Open sidebar panel" aria-expanded={false} title={`Open sidebar (${mod}+B)`} onClick={openPanel}>
            <PanelLeftOpen size={20} strokeWidth={1.75} aria-hidden />
          </button>
        ) : null}
        <div className="ps-rail-items">
          {RAIL.map((item) => (
            <RailButton key={item.label} item={item} active={Boolean(item.key) && item.key === active} />
          ))}
          <RailMore active={active} />
        </div>
        <div className="ps-rail-foot">
          <ModeToggle side="right" />
          <Avatar />
        </div>
      </nav>

      {full ? (
        <div className="ps-panel" data-open={panelOpen ? "true" : "false"} inert={!panelOpen} aria-hidden={!panelOpen}>
          <WorkspaceCard mod={mod} onClose={closePanel} />

          {/* Only this middle part scrolls; the header above and the AI card below stay put. */}
          <div className="ps-panel-scroll">
          <div className="ps-panel-group">
            <PanelRow icon={Plus} href="/new" active={active === "new"}>
              New deck
            </PanelRow>
          </div>

          <div className="ps-panel-rule" />
          <DeckLists />

          <div className="ps-panel-rule" />
          <p className="ps-panel-kicker">Workspace</p>
          <div className="ps-panel-group">
            <PanelRow icon={Share2} href="/#shared">
              Shared with me
            </PanelRow>
            <PanelRow icon={UsersRound} href="/teams" active={active === "teams"}>
              Teams
            </PanelRow>
            <PanelRow icon={Folder} href="/decks" active={active === "decks"}>
              Folders
            </PanelRow>
            <PanelRow icon={ChartLine} href="/analytics" active={active === "analytics"}>
              Analytics
            </PanelRow>
            <PanelRow icon={Plug} href="/integrations" active={active === "integrations"}>
              Integrations
            </PanelRow>
          </div>

          <div className="ps-panel-labs">
            <div className="ps-panel-labs-head">
              <span className="ps-panel-labs-title">
                <FlaskConical size={15} strokeWidth={1.75} aria-hidden /> Labs
              </span>
              <span className="ps-panel-new-chip">New</span>
            </div>
            <p className="ps-panel-labs-sub">Futuristic previews we are building.</p>
            <ul className="ps-panel-labs-list">
              {LABS_HIGHLIGHTS.map((id) => {
                const f = LABS_FEATURES.find((x) => x.id === id);
                if (!f) return null;
                return (
                  <li key={id}>
                    <Link href={`/labs#${id}`} className="ps-panel-lab" style={{ "--lab-a": f.tint[0], "--lab-b": f.tint[1] } as React.CSSProperties}>
                      <span className="ps-panel-lab-icon" aria-hidden>
                        {f.icon}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{f.title}</span>
                      <span className="ps-pill" data-tone="soon">
                        Soon
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <Link href="/labs" className="ps-panel-labs-all">
              Explore all labs <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
          </div>

          <div className="ps-panel-foot">
            <AiStatus />
          </div>
        </div>
      ) : null}
    </aside>
  );
}
