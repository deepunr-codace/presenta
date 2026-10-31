"use client";

import { useEffect } from "react";
import { ArrowClockwise, ArrowCounterClockwise, Check, FloppyDisk, SidebarSimple, WarningCircle } from "@phosphor-icons/react";
import { saveNow, useDeckStore } from "@/store/deck-store";
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
  const saving = useDeckStore((s) => s.saving);
  const undo = useDeckStore((s) => s.undo);
  const redo = useDeckStore((s) => s.redo);
  const sidebarOpen = useSidebarStore((s) => s.open);
  const setSidebarOpen = useSidebarStore((s) => s.setOpen);

  // Ctrl+S / ⌘S saves now instead of opening the browser's "Save page" dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveNow();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!deck) return null;

  const state = saving ? "saving" : saveError ? "error" : dirty ? "dirty" : "saved";

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

        {/* Autosave status and a Save button in one: it saves on its own, and you can save now any time. */}
        <button
          type="button"
          className="ps-save"
          data-state={state}
          onClick={() => void saveNow()}
          disabled={state === "saved" || state === "saving"}
          aria-live="polite"
          title={saveError ? `Not saved: ${saveError} Click to try again.` : state === "saved" ? "All changes saved" : "Save now (Ctrl+S)"}
        >
          {state === "saved" ? <Check size={12} weight="bold" aria-hidden /> : state === "error" ? <WarningCircle size={12} weight="bold" aria-hidden /> : state === "saving" ? <span className="ps-save-dot" aria-hidden /> : <FloppyDisk size={12} aria-hidden />}
          {state === "saved" ? "Saved" : state === "saving" ? "Saving…" : state === "error" ? "Not saved · Retry" : "Save"}
        </button>
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
