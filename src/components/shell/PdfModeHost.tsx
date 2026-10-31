"use client";

import { useState } from "react";
import { FileText, Sparkle } from "@phosphor-icons/react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { answerPdfMode, usePdfModeStore, type PdfMode } from "@/lib/pdf-mode";

const OPTIONS: { id: PdfMode; title: string; body: string; icon: typeof Sparkle }[] = [
  {
    id: "smart",
    title: "Smart convert",
    body: "AI rebuilds each page: cards and boxes become shapes, photos and icons become separate pictures, text becomes text boxes. Uses one AI request per page and takes a little longer.",
    icon: Sparkle,
  },
  {
    id: "standard",
    title: "Standard",
    body: "Fast and free, in your browser. Text becomes editable; designs made in Canva or Figma may keep their artwork as one picture.",
    icon: FileText,
  },
];

/** Asks how to convert a PDF before an import starts (see `askPdfMode`). Mounted once in the app shell. */
export function PdfModeHost() {
  const fileName = usePdfModeStore((s) => s.fileName);
  const [mode, setMode] = useState<PdfMode>("smart");

  return (
    <Dialog open={fileName !== null} onOpenChange={(open) => !open && answerPdfMode(null)}>
      <DialogContent style={{ maxWidth: "min(32rem, calc(100% - 2rem))" }}>
        <DialogHeader>
          <DialogTitle>Convert this PDF</DialogTitle>
          <DialogDescription className="truncate">{fileName}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2" role="radiogroup" aria-label="How to convert">
          {OPTIONS.map((o) => {
            const Icon = o.icon;
            const on = mode === o.id;
            return (
              <button key={o.id} type="button" role="radio" aria-checked={on} className="ps-scope-card flex items-start gap-3 text-left" data-active={on ? "" : undefined} onClick={() => setMode(o.id)}>
                <span className={o.id === "smart" ? "ps-reply-icon mt-0.5" : "mt-0.5 inline-grid size-[22px] shrink-0 place-items-center rounded-lg bg-[var(--ps-plate)]"} aria-hidden>
                  <Icon size={12} weight={o.id === "smart" ? "fill" : "regular"} />
                </span>
                <span className="min-w-0">
                  <span className="ps-scope-title">{o.title}</span>
                  <span className="ps-caption mt-0.5 block">{o.body}</span>
                </span>
              </button>
            );
          })}
        </div>
        <DialogFooter>
          <button type="button" className="ps-btn" onClick={() => answerPdfMode(null)}>
            Cancel
          </button>
          <button type="button" className="ps-btn ps-btn-primary" onClick={() => answerPdfMode(mode)}>
            {mode === "smart" ? "Smart convert" : "Convert"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
