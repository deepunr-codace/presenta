"use client";

import type { PointerEvent, Ref } from "react";
import { DotsSixVertical, Trash } from "@phosphor-icons/react";
import type { OutlineItem } from "@/lib/deck/schema";
import { FIELD } from "@/lib/styles";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChipEditor } from "./ChipEditor";
import { KINDS, KIND_LABEL, isKind } from "./outline-kinds";

const INLINE_INPUT = "min-w-0 rounded-[var(--ps-r-input)] border border-transparent bg-transparent px-2 outline-none transition-colors hover:border-[var(--ps-line-2)] focus:border-[var(--ps-ink)] focus-visible:ring-2 focus-visible:ring-[var(--ps-ink-ring)]";

type Props = {
  slide: OutlineItem;
  index: number;
  dragging: boolean;
  /** Drop indicator position while another row is dragged over this one. */
  dropLine: "above" | "below" | null;
  canDelete: boolean;
  rowRef: Ref<HTMLLIElement>;
  onPatch: (patch: Partial<OutlineItem>) => void;
  onDelete: () => void;
  onHandleDown: (e: PointerEvent<HTMLButtonElement>) => void;
  onHandleMove: (e: PointerEvent<HTMLButtonElement>) => void;
  onHandleUp: (e: PointerEvent<HTMLButtonElement>) => void;
  onHandleCancel: () => void;
};

/**
 * One outline tile: drag handle, number, title, kind, goal and key points.
 * Under `sm` the kind select and delete button stack under the title.
 */
export function OutlineRow({ slide, index, dragging, dropLine, canDelete, rowRef, onPatch, onDelete, onHandleDown, onHandleMove, onHandleUp, onHandleCancel }: Props) {
  return (
    <li ref={rowRef} className={cn("ps-tile relative min-w-0 p-3 transition-opacity", dragging && "opacity-50 ring-2 ring-[var(--ps-ink-ring)]")}>
      {dropLine === "above" ? <span className="pointer-events-none absolute -top-[5px] right-2 left-2 h-0.5 rounded bg-[var(--ps-ink)]" aria-hidden /> : null}
      {dropLine === "below" ? <span className="pointer-events-none absolute right-2 -bottom-[5px] left-2 h-0.5 rounded bg-[var(--ps-ink)]" aria-hidden /> : null}
      <div className="flex min-w-0 items-start gap-2">
        <button
          type="button"
          aria-label={`Drag to reorder slide ${index + 1}`}
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleCancel}
          className="ps-iconbtn ps-iconbtn-sm mt-1 shrink-0 cursor-grab touch-none text-[var(--ps-ash)] active:cursor-grabbing"
        >
          <DotsSixVertical size={16} weight="bold" />
        </button>
        <span className="mt-1.5 w-5 shrink-0 text-right text-[12px] tabular-nums text-[var(--ps-ash)]">{index + 1}</span>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start">
            <input value={slide.title} maxLength={80} aria-label={`Slide ${index + 1} title`} onChange={(e) => onPatch({ title: e.target.value })} className={cn(INLINE_INPUT, "h-8 w-full text-[14px] font-medium text-[var(--ps-ink)] sm:flex-1")} placeholder="Slide title" />
            <div className="flex min-w-0 items-center gap-2">
              <Select value={slide.kind} items={KIND_LABEL} onValueChange={(v) => isKind(v) && onPatch({ kind: v })}>
                <SelectTrigger aria-label={`Slide ${index + 1} kind`} className={cn(FIELD, "h-8 min-w-0 flex-1 text-[13px] sm:w-[160px] sm:flex-none")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {KIND_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button type="button" aria-label={`Delete slide ${index + 1}`} onClick={onDelete} disabled={!canDelete} data-danger="true" className="ps-iconbtn ps-iconbtn-sm shrink-0">
                <Trash />
              </button>
            </div>
          </div>
          <input value={slide.goal} maxLength={140} aria-label={`Slide ${index + 1} goal`} onChange={(e) => onPatch({ goal: e.target.value })} className={cn(INLINE_INPUT, "h-7 w-full text-[13px] text-[var(--ps-smoke)]")} placeholder="What this slide should get across" />
          <div className="min-w-0 px-2">
            <ChipEditor value={slide.keyPoints ?? []} onChange={(v) => onPatch({ keyPoints: v })} max={4} maxLength={100} size="sm" placeholder="Key point" ariaLabel={`Slide ${index + 1} key points`} />
          </div>
        </div>
      </div>
    </li>
  );
}
