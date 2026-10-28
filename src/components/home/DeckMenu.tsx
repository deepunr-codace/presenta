"use client";

import { ArrowSquareOut, Copy, DotsThree, DownloadSimple, FolderOpen, PencilSimple, ShareNetwork, Star, Trash } from "@phosphor-icons/react";
import { useStarred } from "@/hooks/useStarred";
import { toggleStarred } from "@/lib/starred";
import type { DeckSummary } from "@/lib/persist";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { DeckActions } from "./deck-actions";

type Props = { summary: DeckSummary; actions: DeckActions };

/** Three-dot menu on a deck card: open, edit, duplicate, export, delete. */
export function DeckMenu({ summary, actions }: Props) {
  const starred = useStarred().includes(summary.id);
  return (
    <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger render={<button type="button" className="ps-iconbtn ps-iconbtn-sm -mt-1 -mr-1.5" aria-label={`Actions for ${summary.title || "Untitled deck"}`} />}>
          <DotsThree size={16} weight="bold" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => actions.onOpen(summary.id)}>
            <ArrowSquareOut /> Open
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => actions.onEdit(summary.id)}>
            <PencilSimple /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => toggleStarred(summary.id)}>
            <Star weight={starred ? "fill" : "regular"} /> {starred ? "Remove star" : "Star"}
          </DropdownMenuItem>
          {actions.onShare ? (
            <DropdownMenuItem onClick={() => actions.onShare?.(summary)}>
              <ShareNetwork /> Share
            </DropdownMenuItem>
          ) : null}
          {actions.onMove ? (
            <DropdownMenuItem onClick={() => actions.onMove?.(summary)}>
              <FolderOpen /> Move to folder
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onClick={() => actions.onDuplicate(summary.id)}>
            <Copy /> Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => actions.onExport(summary.id)}>
            <DownloadSimple /> Export JSON
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => actions.onDelete(summary)}>
            <Trash /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
