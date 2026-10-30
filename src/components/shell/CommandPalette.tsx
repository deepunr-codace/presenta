"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { ChartLineUp, Command, Flask, Gear, PlugsConnected, Images, Key, Keyboard, Layout, MagnifyingGlass, Palette, Plus, Presentation, SquaresFour, Trash, House, UsersThree, type IconProps } from "@phosphor-icons/react";
import { listDecks, type DeckSummary } from "@/lib/persist";
import { timeAgo } from "@/lib/time";
import { TEMPLATES } from "@/components/templates/templates-data";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useIsMac } from "@/hooks/useStarred";
import { useApiKeyDialog } from "./api-key-dialog-store";
import { useOverlays } from "./overlay-store";

type Entry = { id: string; group: "Go to" | "Decks" | "Templates"; label: string; hint?: string; icon: ComponentType<IconProps>; run: () => void };

/**
 * Search at ⌘K / Ctrl+K: jump to a page, open a deck or start from a template. Type to filter, arrows to move,
 * Enter to open. Mounted once in the app shell.
 */
export function CommandPalette() {
  const router = useRouter();
  const open = useOverlays((s) => s.search);
  const setOpen = useOverlays((s) => s.setSearch);
  const setShortcuts = useOverlays((s) => s.setShortcuts);
  const openKey = useApiKeyDialog((s) => s.setOpen);

  // Global shortcut.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        useOverlays.getState().setSearch(!useOverlays.getState().search);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="ps-cmdk" showCloseButton={false}>
        <DialogTitle className="sr-only">Search</DialogTitle>
        <DialogDescription className="sr-only">Search decks, pages and templates</DialogDescription>
        {/* Mounted only while open, so it always starts empty and re-reads the decks. */}
        <PaletteBody
          onClose={() => setOpen(false)}
          go={(href) => {
            setOpen(false);
            router.push(href);
          }}
          openKey={() => {
            setOpen(false);
            openKey(true);
          }}
          openShortcuts={() => {
            setOpen(false);
            setShortcuts(true);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function PaletteBody({ onClose, go, openKey, openShortcuts }: { onClose: () => void; go: (href: string) => void; openKey: () => void; openShortcuts: () => void }) {
  const [query, setQuery] = useState("");
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [index, setIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const isMac = useIsMac();

  useEffect(() => {
    let alive = true;
    listDecks()
      .then((list) => alive && setDecks(list))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const entries = useMemo<Entry[]>(() => {
    const pages: Entry[] = [
      { id: "new", group: "Go to", label: "New deck", icon: Plus, run: () => go("/new") },
      { id: "home", group: "Go to", label: "Home", icon: House, run: () => go("/") },
      { id: "decks", group: "Go to", label: "All decks", icon: SquaresFour, run: () => go("/decks") },
      { id: "templates", group: "Go to", label: "Templates", icon: Layout, run: () => go("/templates") },
      { id: "media", group: "Go to", label: "Media library", icon: Images, run: () => go("/media") },
      { id: "teams", group: "Go to", label: "Teams", icon: UsersThree, run: () => go("/teams") },
      { id: "analytics", group: "Go to", label: "Analytics", icon: ChartLineUp, run: () => go("/analytics") },
      { id: "integrations", group: "Go to", label: "Integrations", icon: PlugsConnected, run: () => go("/integrations") },
      { id: "settings", group: "Go to", label: "Settings", hint: "Storage, profile, security", icon: Gear, run: () => go("/account") },
      { id: "brand", group: "Go to", label: "Brand kit", icon: Palette, run: () => go("/brand") },
      { id: "labs", group: "Go to", label: "Labs", icon: Flask, run: () => go("/labs") },
      { id: "trash", group: "Go to", label: "Trash", icon: Trash, run: () => go("/trash") },
      { id: "key", group: "Go to", label: "API key", hint: "Settings", icon: Key, run: openKey },
      { id: "shortcuts", group: "Go to", label: "Keyboard shortcuts", icon: Keyboard, run: openShortcuts },
    ];
    const deckEntries: Entry[] = decks.map((d) => ({ id: `deck-${d.id}`, group: "Decks", label: d.title || "Untitled deck", hint: timeAgo(d.updatedAt), icon: Presentation, run: () => go(`/deck/${d.slug || d.id}`) }));
    const templateEntries: Entry[] = TEMPLATES.map((t) => ({ id: `tpl-${t.id}`, group: "Templates", label: t.title, hint: `${t.slides} slides`, icon: Layout, run: () => go("/templates") }));
    const q = query.trim().toLowerCase();
    const all = [...pages, ...deckEntries, ...templateEntries];
    return q ? all.filter((e) => e.label.toLowerCase().includes(q)) : [...pages.slice(0, 6), ...deckEntries.slice(0, 4)];
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers are recreated every render; only the data matters
  }, [decks, query]);

  const active = Math.min(index, Math.max(0, entries.length - 1));

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, entries.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      entries[active]?.run();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  let lastGroup = "";
  return (
    <div onKeyDown={onKeyDown}>
      <div className="ps-cmdk-bar">
        <MagnifyingGlass size={18} aria-hidden />
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
          placeholder="Search decks, pages and templates…"
          role="combobox"
          aria-expanded
          aria-controls="ps-cmdk-list"
          aria-activedescendant={entries[active] ? `ps-cmdk-${entries[active].id}` : undefined}
          aria-label="Search"
          autoComplete="off"
          spellCheck={false}
        />
        <kbd className="ps-kbd">Esc</kbd>
      </div>
      <ul id="ps-cmdk-list" ref={listRef} role="listbox" className="ps-cmdk-list">
        {entries.length === 0 ? (
          <li className="ps-cmdk-empty" role="presentation">
            Nothing matches “{query}”.
          </li>
        ) : (
          entries.map((e, i) => {
            const header = e.group !== lastGroup ? e.group : null;
            lastGroup = e.group;
            return (
              <li key={e.id} role="presentation">
                {header ? <p className="ps-cmdk-group">{header}</p> : null}
                <button id={`ps-cmdk-${e.id}`} type="button" role="option" aria-selected={i === active} data-active={i === active ? "true" : undefined} className="ps-cmdk-item" onMouseMove={() => setIndex(i)} onClick={e.run}>
                  <e.icon size={18} aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{e.label}</span>
                  {e.hint ? <span className="ps-cmdk-hint">{e.hint}</span> : null}
                </button>
              </li>
            );
          })
        )}
      </ul>
      <div className="ps-cmdk-foot">
        <span>
          <kbd className="ps-kbd">↑</kbd> <kbd className="ps-kbd">↓</kbd> to move
        </span>
        <span>
          <kbd className="ps-kbd">↵</kbd> to open
        </span>
        <span className="ml-auto inline-flex items-center gap-1">
          {isMac ? <Command size={12} aria-hidden /> : <kbd className="ps-kbd">Ctrl</kbd>}
          <kbd className="ps-kbd">K</kbd> to toggle
        </span>
      </div>
    </div>
  );
}
