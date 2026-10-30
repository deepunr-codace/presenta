"use client";

import { useState, type DragEvent } from "react";
import { DotsThree, FolderOpen, FolderSimple, PencilSimple, Trash } from "@phosphor-icons/react";
import type { Folder } from "@/lib/drive";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DECK_DRAG, FOLDER_DRAG } from "./drag";

type Props = {
  folder: Folder;
  onOpen: (id: string) => void;
  onRename: (folder: Folder) => void;
  onMove: (folder: Folder) => void;
  onDelete: (folder: Folder) => void;
  /** A deck or folder was dropped on this folder. */
  onDropItem: (kind: "deck" | "folder", id: string, into: Folder) => void;
};

/** A glossy 3D-rendered folder: amber gradient shell with a stack of papers peeking out the top. */
function FolderGlyph() {
  return (
    <svg viewBox="0 0 64 54" className="ps-folder-glyph" aria-hidden>
      <defs>
        <linearGradient id="ps-folder-back-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f3b53c" />
          <stop offset="1" stopColor="#e39a1c" />
        </linearGradient>
        <linearGradient id="ps-folder-front-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffcf5c" />
          <stop offset="1" stopColor="#f5a81f" />
        </linearGradient>
      </defs>
      <path d="M6 8h13.9a5 5 0 0 1 3.6 1.5L28.5 14H50a6 6 0 0 1 6 6v4H6z" fill="url(#ps-folder-back-grad)" />
      <rect x="15" y="4" width="26" height="16" rx="2" fill="#fdfdfb" />
      <rect x="15" y="4" width="26" height="16" rx="2" fill="none" stroke="#e7e4da" strokeWidth="1" />
      <line x1="19" y1="9" x2="37" y2="9" stroke="#bcd4f0" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="19" y1="13" x2="33" y2="13" stroke="#d7dde6" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="19" y1="17" x2="35" y2="17" stroke="#d7dde6" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M5 18h54v22.5a6 6 0 0 1-6 6H11a6 6 0 0 1-6-6z" fill="url(#ps-folder-front-grad)" />
      <path d="M5 18h54v4H5z" fill="#fff" fillOpacity="0.35" />
      <path d="M5 40.5v-4h54v4a6 6 0 0 1-6 6H11a6 6 0 0 1-6-6z" fill="#b5700c" fillOpacity="0.18" />
    </svg>
  );
}

/** A folder tile, like in a file manager: click to open, drop a deck on it to file the deck inside. */
export function FolderCard({ folder, onOpen, onRename, onMove, onDelete, onDropItem }: Props) {
  const [over, setOver] = useState(false);

  const accepts = (e: DragEvent) => e.dataTransfer.types.includes(DECK_DRAG) || e.dataTransfer.types.includes(FOLDER_DRAG);

  return (
    <li
      className="ps-glass ps-focus group relative flex cursor-pointer flex-col items-center gap-2 px-3 pb-3 pt-4 text-center"
      data-paper
      data-clickable
      data-over={over ? "true" : undefined}
      style={over ? { outline: "2px solid var(--ps-ink)", outlineOffset: -2 } : undefined}
      tabIndex={0}
      role="link"
      aria-label={`Open folder ${folder.name}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(FOLDER_DRAG, folder.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(e) => {
        if (!accepts(e)) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        const deck = e.dataTransfer.getData(DECK_DRAG);
        const sub = e.dataTransfer.getData(FOLDER_DRAG);
        if (deck) onDropItem("deck", deck, folder);
        else if (sub && sub !== folder.id) onDropItem("folder", sub, folder);
        e.preventDefault();
      }}
      onClick={() => onOpen(folder.id)}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onOpen(folder.id);
        }
      }}
    >
      <span className="ps-folder-tile" aria-hidden>
        <FolderGlyph />
      </span>
      <span className="w-full min-w-0">
        <span className="block truncate text-[13.5px] font-medium text-[var(--ps-ink)]">{folder.name}</span>
        <span className="ps-caption block">
          {folder.deckCount} {folder.deckCount === 1 ? "deck" : "decks"}
        </span>
      </span>
      <div
        className="absolute right-2 top-2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger render={<button type="button" className="ps-iconbtn ps-iconbtn-sm" aria-label={`Actions for folder ${folder.name}`} />}>
            <DotsThree size={16} weight="bold" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => onOpen(folder.id)}>
              <FolderOpen /> Open
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRename(folder)}>
              <PencilSimple /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onMove(folder)}>
              <FolderSimple /> Move to folder
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => onDelete(folder)}>
              <Trash /> Delete folder
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
