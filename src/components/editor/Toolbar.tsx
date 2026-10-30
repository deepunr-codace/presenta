"use client";

import { ArrowClockwise, ArrowCounterClockwise, SidebarSimple } from "@phosphor-icons/react";
import { useDeckStore } from "@/store/deck-store";
import { useSidebarStore } from "@/components/sidebar/sidebar-store";
import { AddMenu } from "./AddMenu";
import { DeckActions } from "./DeckActions";
import { ThemePicker } from "./ThemePicker";
import { TitleEditor } from "./TitleEditor";

/** 48 px tool row under the nav (DESIGN.md §6): title, undo/redo, Add, Theme, save tag; right: panel toggle, Export outline and Present filled pills. */
export function Toolbar() {
  const deck = useDeckStore((s) => s.deck);
  const canUndo = useDeckStore((s) => s.past.length > 0);
  const canRedo = useDeckStore((s) => s.future.length > 0);
  const dirty = useDeckStore((s) => s.dirty);
  const saveError = useDeckStore((s) => s.saveError);
  const undo = useDeckStore((s) => s.undo);
  const redo = useDeckStore((s) => s.redo);
  const sidebarOpen = useSidebarStore((s) => s.open);
  const setSidebarOpen = useSidebarStore((s) => s.setOpen);

  if (!deck) return null;

  return (
    <div className="ps-toolbar" role="toolbar" aria-label="Deck tools">
      <div className="ps-toolbar-main" role="group" aria-label="Editing tools">
        <TitleEditor />

        <span className="ps-toolbar-sep" aria-hidden />

        <button type="button" className="ps-iconbtn" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z / ⌘Z)" aria-label="Undo">
          <ArrowCounterClockwise size={16} />
        </button>
        <button type="button" className="ps-iconbtn" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y / Ctrl+Shift+Z / ⇧⌘Z)" aria-label="Redo">
          <ArrowClockwise size={16} />
        </button>

        <span className="ps-toolbar-sep" aria-hidden />

        <AddMenu />
        <ThemePicker />

        <span className="ps-save" data-dirty={dirty} data-error={saveError ? "true" : undefined} aria-live="polite" title={saveError ?? undefined}>
          <span className="ps-save-dot" aria-hidden />
          {saveError ? "Not saved" : dirty ? "Saving…" : "Saved"}
        </span>
      </div>

      <div className="flex-1" />

      <div className="ps-toolbar-right" role="group" aria-label="Deck actions">
        <div className="ps-toolbar-actions">
          <DeckActions id={deck.id} mode="edit" />
        </div>
        <button type="button" className="ps-iconbtn" aria-pressed={sidebarOpen} onClick={() => setSidebarOpen(!sidebarOpen)} title={sidebarOpen ? "Hide the side panel" : "Show the side panel"} aria-label={sidebarOpen ? "Hide the side panel" : "Show the side panel"}>
          <SidebarSimple size={16} mirrored />
        </button>
      </div>
    </div>
  );
}
