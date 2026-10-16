"use client";

import { useState } from "react";
import { ArrowLineDown, ArrowLineUp, Copy, LinkSimple, LinkSimpleBreak, Lock, LockOpen, Trash } from "@phosphor-icons/react";
import type { Element, Slide } from "@/lib/deck/schema";
import { useDeckStore, type ElementPatch } from "@/store/deck-store";
import { NumInput } from "@/components/ui-kit/NumInput";
import { PercentSlider } from "@/components/ui-kit/PercentSlider";
import { PropertyGroup } from "@/components/ui-kit/PropertyGroup";
import { PropertyRow } from "@/components/ui-kit/PropertyRow";

type Props = { slide: Slide; element: Element; patch: (p: ElementPatch) => void };

const HAS_RADIUS = new Set<Element["type"]>(["image", "shape"]);

/** Position, size, rotation, opacity, radius, lock, order, duplicate and delete for any element. */
export function BoxProps({ slide, element, patch }: Props) {
  const deleteElements = useDeckStore((s) => s.deleteElements);
  const duplicateElements = useDeckStore((s) => s.duplicateElements);
  const commit = useDeckStore((s) => s.commit);
  const [lockRatio, setLockRatio] = useState(element.type === "image" || element.type === "icon");

  const ratio = element.h > 0 ? element.w / element.h : 1;
  const setW = (w: number) => patch(lockRatio ? { w, h: Math.max(1, Math.round(w / ratio)) } : { w });
  const setH = (h: number) => patch(lockRatio ? { h, w: Math.max(1, Math.round(h * ratio)) } : { h });

  const swapZ = (direction: 1 | -1) => {
    const others = slide.elements.filter((e) => e.id !== element.id);
    const neighbour = direction === 1 ? others.filter((e) => e.z > element.z).sort((a, b) => a.z - b.z)[0] : others.filter((e) => e.z < element.z).sort((a, b) => b.z - a.z)[0];
    commit((d) => {
      const s = d.slides.find((x) => x.id === slide.id);
      const a = s?.elements.find((e) => e.id === element.id);
      if (!s || !a) return;
      const b = neighbour ? s.elements.find((e) => e.id === neighbour.id) : undefined;
      if (b) {
        [a.z, b.z] = [b.z, a.z];
      } else if (others.some((e) => e.z === element.z)) {
        const zs = s.elements.map((e) => e.z);
        a.z = direction === 1 ? Math.max(...zs) + 1 : Math.min(...zs) - 1;
      }
    }, direction === 1 ? "Bring forward" : "Send backward");
  };
  const canForward = slide.elements.some((e) => e.id !== element.id && e.z >= element.z);
  const canBackward = slide.elements.some((e) => e.id !== element.id && e.z <= element.z);

  const radius = element.type === "image" || element.type === "shape" ? element.radius : undefined;

  return (
    <PropertyGroup
      title={`${element.type.charAt(0).toUpperCase()}${element.type.slice(1)}`}
      action={
        <div className="flex items-center gap-0.5">
          <button type="button" className="ps-iconbtn" title="Duplicate (⌘D)" aria-label="Duplicate element" onClick={() => duplicateElements(slide.id, [element.id])}>
            <Copy size={14} />
          </button>
          <button type="button" className="ps-iconbtn" data-danger="true" title="Delete" aria-label="Delete element" onClick={() => deleteElements(slide.id, [element.id])}>
            <Trash size={14} />
          </button>
        </div>
      }
    >
      <div className="ps-row">
        <span className="ps-row-label">Position</span>
        <div className="ps-row-2">
          <div className="ps-pair">
            <span className="ps-pair-k" aria-hidden>
              X
            </span>
            <NumInput aria-label="X" value={element.x} onCommit={(x) => patch({ x })} />
          </div>
          <div className="ps-pair">
            <span className="ps-pair-k" aria-hidden>
              Y
            </span>
            <NumInput aria-label="Y" value={element.y} onCommit={(y) => patch({ y })} />
          </div>
        </div>
      </div>
      <div className="ps-row">
        <span className="ps-row-label">Size</span>
        <div className="flex items-center gap-1.5">
          <div className="ps-row-2 min-w-0 flex-1">
            <div className="ps-pair">
              <span className="ps-pair-k" aria-hidden>
                W
              </span>
              <NumInput aria-label="Width" value={element.w} min={1} onCommit={setW} />
            </div>
            <div className="ps-pair">
              <span className="ps-pair-k" aria-hidden>
                H
              </span>
              <NumInput aria-label="Height" value={element.h} min={1} onCommit={setH} />
            </div>
          </div>
          <button type="button" className="ps-iconbtn" aria-pressed={lockRatio} title={lockRatio ? "Unlock aspect ratio" : "Lock aspect ratio"} aria-label="Lock aspect ratio" onClick={() => setLockRatio((v) => !v)}>
            {lockRatio ? <LinkSimple size={14} /> : <LinkSimpleBreak size={14} />}
          </button>
        </div>
      </div>
      <PropertyRow label="Rotation">
        <NumInput aria-label="Rotation" value={element.rotation} digits={1} step={1} onCommit={(rotation) => patch({ rotation })} />
        <span className="ps-caption">°</span>
      </PropertyRow>
      <PropertyRow label="Opacity">
        <PercentSlider aria-label="Opacity" value={element.opacity} onCommit={(opacity) => patch({ opacity })} />
      </PropertyRow>
      {radius !== undefined && HAS_RADIUS.has(element.type) ? (
        <PropertyRow label="Radius">
          <NumInput aria-label="Corner radius" value={radius} min={0} onCommit={(r) => patch({ radius: Math.max(0, r) } as ElementPatch)} />
        </PropertyRow>
      ) : null}
      <PropertyRow label="Lock">
        <button type="button" className="ps-iconbtn ps-iconbtn-outline" aria-pressed={element.locked} title={element.locked ? "Unlock" : "Lock position and size"} aria-label="Lock element" onClick={() => patch({ locked: !element.locked })}>
          {element.locked ? <Lock size={14} /> : <LockOpen size={14} />}
        </button>
        <span className="ps-caption">{element.locked ? "Locked" : "Unlocked"}</span>
      </PropertyRow>
      <PropertyRow label="Order">
        <button type="button" className="ps-btn" onClick={() => swapZ(1)} disabled={!canForward} title="Bring forward">
          <ArrowLineUp size={12} /> Forward
        </button>
        <button type="button" className="ps-btn" onClick={() => swapZ(-1)} disabled={!canBackward} title="Send backward">
          <ArrowLineDown size={12} /> Back
        </button>
      </PropertyRow>
    </PropertyGroup>
  );
}
