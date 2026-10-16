"use client";

import type { PointerEvent, Ref } from "react";
import { Copy, DotsThree, Plus, Trash } from "@phosphor-icons/react";
import { STAGE_W, type Slide, type Theme } from "@/lib/deck/schema";
import { SlideRenderer } from "@/components/canvas/SlideRenderer";
import { slideTitle } from "@/components/review/deck-stats";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/* 200 px column, 12 px gutters: the tile fills the rest. */
const THUMB_W = 176;
const THUMB_H = Math.round((THUMB_W * 9) / 16);
const THUMB_SCALE = THUMB_W / STAGE_W;

type Props = {
  slide: Slide;
  theme: Theme;
  index: number;
  active: boolean;
  dragging: boolean;
  /** Draw the drop indicator above or below this tile while another one is dragged. */
  dropLine: "top" | "bottom" | null;
  canDelete: boolean;
  rowRef: Ref<HTMLDivElement>;
  onPointerDown: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: () => void;
  onDuplicate: () => void;
  onAddAfter: () => void;
  onDelete: () => void;
};

/** One filmstrip row: scaled slide thumbnail with a primary ring when active, a caption row (number and title) and a hover actions menu. */
export function FilmstripTile({ slide, theme, index, active, dragging, dropLine, canDelete, rowRef, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onDuplicate, onAddAfter, onDelete }: Props) {
  const title = slideTitle(slide);
  return (
    <div ref={rowRef} role="option" aria-selected={active} aria-label={`Slide ${index + 1}`} className="ps-thumb-row" data-dragging={dragging || undefined} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}>
      <div className="ps-thumb" data-active={active} style={{ width: THUMB_W, height: THUMB_H }}>
        <div className="pointer-events-none">
          <SlideRenderer slide={slide} theme={theme} scale={THUMB_SCALE} />
        </div>
      </div>
      <div className="ps-thumb-cap" data-active={active} style={{ width: THUMB_W }} aria-hidden>
        <span className="ps-thumb-cap-num">{index + 1}</span>
        <span className="ps-thumb-cap-title">{title}</span>
      </div>
      <span data-no-drag className="ps-thumb-menu">
        <DropdownMenu>
          <DropdownMenuTrigger render={<button type="button" className="ps-iconbtn" aria-label={`Slide ${index + 1} actions`} />}>
            <DotsThree size={14} weight="bold" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-40">
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onAddAfter}>
              <Plus /> Add slide after
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" disabled={!canDelete} onClick={onDelete}>
              <Trash /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
      {dropLine === "top" ? <span className="ps-drop-line" style={{ top: -1 }} aria-hidden /> : null}
      {dropLine === "bottom" ? <span className="ps-drop-line" style={{ bottom: -1 }} aria-hidden /> : null}
    </div>
  );
}
