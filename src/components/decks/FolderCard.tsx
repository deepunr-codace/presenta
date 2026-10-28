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

/** A folder tile, like in a file manager: click to open, drop a deck on it to file the deck inside. */
export function FolderCard({ folder, onOpen, onRename, onMove, onDelete, onDropItem }: Props) {
  const [over, setOver] = useState(false);

  const accepts = (e: DragEvent) => e.dataTransfer.types.includes(DECK_DRAG) || e.dataTransfer.types.includes(FOLDER_DRAG);

  return (
    <li
      className="ps-glass ps-focus flex cursor-pointer items-center gap-3 p-3"
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
      <span className="grid size-10 shrink-0 place-items-center rounded-[var(--ps-r-md)] bg-[var(--ps-plate)] text-[var(--ps-ink)]" aria-hidden>
        <FolderSimple size={22} weight="light" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium text-[var(--ps-ink)]">{folder.name}</span>
        <span className="ps-caption block">
          {folder.deckCount} {folder.deckCount === 1 ? "deck" : "decks"}
        </span>
      </span>
      <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
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
