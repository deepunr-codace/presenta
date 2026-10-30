"use client";

import { ChartBar, FilmStrip, Image as ImageIcon, Plus, Shapes, SquaresFour, Star, TextAa, TextH } from "@phosphor-icons/react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { newId } from "@/lib/deck/ids";
import { STAGE_H, STAGE_W, type Element } from "@/lib/deck/schema";
import { useDeckStore } from "@/store/deck-store";

export type AddKind = "text" | "heading" | "image" | "card" | "shape" | "icon" | "chart" | "video";

function frame(w: number, h: number, z: number) {
  return {
    id: newId("el"),
    x: Math.round((STAGE_W - w) / 2),
    y: Math.round((STAGE_H - h) / 2),
    w,
    h,
    rotation: 0,
    z,
    locked: false,
    opacity: 1,
  };
}

/** A new element of the given kind, centred on the stage at z. */
function buildElement(kind: AddKind, z: number): Element {
  switch (kind) {
    case "text":
      return { ...frame(600, 120, z), type: "text", role: "body", html: "New text", align: "left", valign: "top", autoFit: true, style: {} };
    case "heading":
      return { ...frame(900, 100, z), type: "text", role: "heading", html: "New heading", align: "left", valign: "top", autoFit: true, style: {} };
    case "image":
      return { ...frame(600, 400, z), type: "image", query: "", alt: "", fit: "cover", radius: 24, position: "50% 50%", overlay: 0 };
    case "card":
      return { ...frame(480, 300, z), type: "card", variant: "surface", title: "Card title", body: "Card body" };
    case "shape":
      return { ...frame(400, 240, z), type: "shape", kind: "rect", fill: "accent", strokeWidth: 0, radius: 24 };
    case "icon":
      return { ...frame(120, 120, z), type: "icon", name: "Star", color: "accent", weight: "regular" };
    case "chart":
      return {
        ...frame(800, 420, z),
        type: "chart",
        kind: "bar",
        labels: ["Q1", "Q2", "Q3", "Q4"],
        series: [{ name: "Series 1", values: [12, 18, 24, 31] }],
      };
    case "video":
      return { ...frame(960, 540, z), type: "video", src: "https://www.youtube.com/watch?v=aqz-KE-bpKQ", title: "Embedded video" };
  }
}

const ITEMS: { kind: AddKind; label: string; Icon: typeof TextAa }[] = [
  { kind: "text", label: "Text", Icon: TextAa },
  { kind: "heading", label: "Heading", Icon: TextH },
  { kind: "image", label: "Image", Icon: ImageIcon },
  { kind: "card", label: "Card", Icon: SquaresFour },
  { kind: "shape", label: "Shape", Icon: Shapes },
  { kind: "icon", label: "Icon", Icon: Star },
  { kind: "chart", label: "Chart", Icon: ChartBar },
  { kind: "video", label: "Video", Icon: FilmStrip },
];

/** "Add" dropdown: inserts a new element of the chosen kind, centred on the selected slide. */
export function AddMenu() {
  const slideId = useDeckStore((s) => s.selectedSlideId);
  const addElement = useDeckStore((s) => s.addElement);

  const add = (kind: AddKind) => {
    const state = useDeckStore.getState();
    const slide = state.deck?.slides.find((s) => s.id === state.selectedSlideId);
    if (!slide) return;
    const z = slide.elements.reduce((m, e) => Math.max(m, e.z), -1) + 1;
    addElement(slide.id, buildElement(kind, z));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<button type="button" className="ps-btn" disabled={!slideId} />}>
        <Plus size={12} />
        Add
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-40">
        {ITEMS.map(({ kind, label, Icon }) => (
          <DropdownMenuItem key={kind} onClick={() => add(kind)}>
            <Icon /> {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
