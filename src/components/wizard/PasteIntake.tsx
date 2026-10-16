"use client";

import { useRef, useState, type DragEvent } from "react";
import { ArrowRight, FileText, Paperclip, Trash } from "@phosphor-icons/react";
import { FIELD, GHOST_BTN, PRIMARY_BTN, SECONDARY_BTN } from "@/lib/styles";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useWizardStore } from "./wizard-state";

const ACCEPT = ".txt,.md,.markdown,text/plain,text/markdown";
const MAX_CHARS = 40000;

const PLACEHOLDER = `Paste anything: an outline, meeting notes, a blog post, bullet points, a product brief.

For example:

Q3 business review
- Revenue up 18% QoQ, driven by enterprise
- Churn down to 2.1%
- Two launches: Insights API and mobile app
- Risks: hiring, EU compliance
- Ask: approve 4 new hires for Q4`;

function isTextFile(file: File): boolean {
  return /\.(txt|md|markdown)$/i.test(file.name) || file.type.startsWith("text/");
}

type Props = { onBuildOutline: () => void };

/** Paste or drop text, add an optional audience and goal, then build the outline. */
export function PasteIntake({ onBuildOutline }: Props) {
  const paste = useWizardStore((s) => s.paste);
  const patchPaste = useWizardStore((s) => s.patchPaste);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    if (!isTextFile(file)) {
      setFileError("Only .txt and .md files are supported.");
      return;
    }
    setFileError(null);
    const text = (await file.text()).slice(0, MAX_CHARS);
    patchPaste({ text: paste.text.trim() ? `${paste.text.trimEnd()}\n\n${text}`.slice(0, MAX_CHARS) : text });
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    void readFile(e.dataTransfer.files?.[0]);
  };

  const chars = paste.text.length;
  const words = paste.text.trim() ? paste.text.trim().split(/\s+/).length : 0;
  const ready = paste.text.trim().length > 0;

  return (
    <section className="ps-glass overflow-hidden p-0" aria-label="Paste content">
      <div
        className={cn("relative p-6 transition-colors", dragging && "bg-[var(--ps-plate)]")}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <Textarea
          value={paste.text}
          onChange={(e) => patchPaste({ text: e.target.value.slice(0, MAX_CHARS) })}
          placeholder={PLACEHOLDER}
          aria-label="Content to turn into a deck"
          className={cn(FIELD, "min-h-[320px] resize-y p-3 leading-5")}
        />
        {dragging ? (
          <div className="pointer-events-none absolute inset-3 grid place-items-center rounded-[var(--ps-r-sm)] border-2 border-dashed border-[var(--ps-ink)] bg-[var(--ps-paper)] text-[14px] font-medium text-[var(--ps-ink)]">
            Drop a .txt or .md file
          </div>
        ) : null}
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            void readFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <div className="ps-caption mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className={cn(SECONDARY_BTN, "h-8 px-3.5")} onClick={() => fileRef.current?.click()}>
              <Paperclip data-icon="inline-start" /> Add .txt or .md
            </Button>
            <span className="hidden items-center gap-1 sm:inline-flex">
              <FileText size={12} /> or drop a file here
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className={cn("tabular-nums", chars >= MAX_CHARS && "text-[var(--ps-danger)]")}>
              {chars.toLocaleString()} / {MAX_CHARS.toLocaleString()} characters · {words.toLocaleString()} words
            </span>
            <Button variant="ghost" size="sm" className={cn(GHOST_BTN, "h-8 px-3")} onClick={() => patchPaste({ text: "" })} disabled={!chars}>
              <Trash data-icon="inline-start" /> Clear
            </Button>
          </div>
        </div>
        {fileError ? (
          <p className="mt-2 text-[13px] text-[var(--ps-danger)]" role="alert">
            {fileError}
          </p>
        ) : null}
      </div>

      <div className="grid gap-5 border-t border-[var(--ps-line)] p-6 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="paste-audience" className="ps-label text-[13px] leading-[18px]">
            Audience <span className="font-normal text-[var(--ps-ash)]">(optional)</span>
          </Label>
          <Input
            id="paste-audience"
            value={paste.audience}
            maxLength={120}
            placeholder="e.g. executive team, new customers"
            onChange={(e) => patchPaste({ audience: e.target.value })}
            className={cn(FIELD, "h-9")}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="paste-goal" className="ps-label text-[13px] leading-[18px]">
            Goal <span className="font-normal text-[var(--ps-ash)]">(optional)</span>
          </Label>
          <Input
            id="paste-goal"
            value={paste.goal}
            maxLength={200}
            placeholder="What should the audience do afterwards?"
            onChange={(e) => patchPaste({ goal: e.target.value })}
            className={cn(FIELD, "h-9")}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-[var(--ps-line)] px-6 py-4">
        <p className="ps-caption">{ready ? "We will structure this into slides next." : "Paste or drop some content to continue."}</p>
        <Button className={cn(PRIMARY_BTN, "h-9 px-4")} onClick={onBuildOutline} disabled={!ready}>
          Build outline <ArrowRight data-icon="inline-end" weight="bold" />
        </Button>
      </div>
    </section>
  );
}
