"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useIsMac } from "@/hooks/useStarred";
import { useOverlays } from "./overlay-store";

type Row = { keys: string[]; label: string };
type Section = { title: string; rows: Row[] };

/** Cmd on Apple platforms, Ctrl elsewhere. */
function sections(mod: string): Section[] {
  return [
    {
      title: "Everywhere",
      rows: [
        { keys: [mod, "K"], label: "Search decks, pages and templates" },
        { keys: [mod, "B"], label: "Show or hide the sidebar panel (not in the editor)" },
      ],
    },
    {
      title: "Editor",
      rows: [
        { keys: ["Arrows"], label: "Nudge the selection by 1" },
        { keys: ["Shift", "Arrows"], label: "Nudge the selection by 10" },
        { keys: ["Delete"], label: "Delete the selection" },
        { keys: [mod, "D"], label: "Duplicate the selection" },
        { keys: [mod, "Z"], label: "Undo" },
        { keys: ["Shift", mod, "Z"], label: "Redo" },
        { keys: ["Esc"], label: "Clear the selection or leave text editing" },
        { keys: [mod, "Enter"], label: "Send a message to the assistant" },
      ],
    },
    {
      title: "Presenting",
      rows: [
        { keys: ["← →"], label: "Previous and next slide" },
        { keys: ["Space"], label: "Next slide" },
        { keys: ["N"], label: "Show or hide speaker notes" },
        { keys: ["F"], label: "Fullscreen" },
        { keys: ["Esc"], label: "Exit" },
      ],
    },
  ];
}

/** Keyboard shortcuts reference, opened from the sidebar. */
export function ShortcutsDialog() {
  const open = useOverlays((s) => s.shortcuts);
  const setOpen = useOverlays((s) => s.setShortcuts);
  const mod = useIsMac() ? "⌘" : "Ctrl";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="ps-keys">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Work faster without leaving the keyboard.</DialogDescription>
        </DialogHeader>
        <div className="ps-keys-body">
          {sections(mod).map((s) => (
            <section key={s.title}>
              <h3 className="ps-keys-title">{s.title}</h3>
              <dl className="ps-keys-list">
                {s.rows.map((r) => (
                  <div key={r.label} className="ps-keys-row">
                    <dt>{r.label}</dt>
                    <dd>
                      {r.keys.map((k) => (
                        <kbd key={k} className="ps-kbd">
                          {k}
                        </kbd>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
