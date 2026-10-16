"use client";

import { useEffect, useRef, useState } from "react";
import { useDeckStore } from "@/store/deck-store";

/** Deck title in the toolbar: a pill button that turns into an input on click; Enter commits, Escape cancels. */
export function TitleEditor() {
  const title = useDeckStore((s) => s.deck?.title ?? "");
  const setTitle = useDeckStore((s) => s.setTitle);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const start = () => {
    setDraft(title);
    setEditing(true);
  };

  const commit = () => {
    const next = draft.trim();
    if (next && next !== title) setTitle(next);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
          e.stopPropagation();
        }}
        className="ps-input ps-toolbar-title-input"
        aria-label="Deck title"
      />
    );
  }

  return (
    <button type="button" onClick={start} title="Rename deck" aria-label={`Rename deck: ${title || "Untitled deck"}`} className="ps-toolbar-title">
      {title || "Untitled deck"}
    </button>
  );
}
