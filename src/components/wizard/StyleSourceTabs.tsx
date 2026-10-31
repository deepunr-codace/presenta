"use client";

import { useRef, useState } from "react";
import { Check, FileArrowUp, Image as ImageIcon } from "@phosphor-icons/react";
import { THEMES } from "@/lib/deck/themes";
import { TEMPLATE_DECKS } from "@/lib/deck/template-decks";
import { STUDIO_PACKS } from "@/lib/deck/studio-packs";
import { readStyleReference, type StyleReference } from "@/lib/style-reference";
import { FitSlide } from "@/components/canvas/FitSlide";
import { cn } from "@/lib/utils";
import { ThemeRadioGrid } from "./ThemeRadioGrid";
import { useWizardStore } from "./wizard-state";

type Tab = "theme" | "template" | "reference";
const TABS: { id: Tab; label: string }[] = [
  { id: "theme", label: "Theme" },
  { id: "template", label: "Template" },
  { id: "reference", label: "PDF / image" },
];
const ALL_TEMPLATES = [...TEMPLATE_DECKS, ...STUDIO_PACKS];

/** Where the deck's look comes from at generation time: a built-in theme, a designed template, or a reference file. */
export function StyleSourceTabs() {
  const themeId = useWizardStore((s) => s.themeId);
  const setThemeId = useWizardStore((s) => s.setThemeId);
  const patchBrand = useWizardStore((s) => s.patchBrand);
  const [tab, setTab] = useState<Tab>("theme");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [ref, setRef] = useState<(StyleReference & { name: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const pickTemplate = (id: string) => {
    const t = ALL_TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    setTemplateId(id);
    setThemeId(t.deck.themeId);
  };

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const r = await readStyleReference(file);
      setRef({ ...r, name: file.name });
      setThemeId(r.themeId);
      patchBrand({ accent: r.accent });
    } catch (err) {
      setError(err instanceof Error ? err.message : "That file could not be read.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <section aria-label="Style" className="ps-glass">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="ps-label">Style</h3>
        <div className="ps-seg" role="group" aria-label="Style source">
          {TABS.map((t) => (
            <button key={t.id} type="button" className="ps-seg-item" aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "theme" ? (
        <ThemeRadioGrid
          value={themeId}
          onChange={(id) => {
            setTemplateId(null);
            setThemeId(id);
          }}
        />
      ) : null}

      {tab === "template" ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3" role="radiogroup" aria-label="Template">
          {ALL_TEMPLATES.map((t) => {
            const on = templateId === t.id;
            return (
              <button key={t.id} type="button" role="radio" aria-checked={on} onClick={() => pickTemplate(t.id)} className={cn("ps-tile ps-focus relative flex min-w-0 flex-col overflow-hidden p-0 text-left", on && "ring-2 ring-[var(--ps-ink)]")} data-active={on ? "true" : undefined} data-clickable="">
                <FitSlide slide={t.deck.slides[0]} theme={THEMES[t.deck.themeId]} className="pointer-events-none" />
                <span className="flex items-center gap-1.5 px-2.5 py-2 text-[13px] font-medium text-[var(--ps-ink)]">
                  <span className="min-w-0 flex-1 truncate">{t.title}</span>
                  {on ? <Check size={12} /> : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {tab === "reference" ? (
        <div className="grid gap-3">
          <label className="ps-upload-drop" data-filled={ref ? "true" : undefined}>
            {ref ? <FileArrowUp size={18} /> : <ImageIcon size={18} />}
            <span className="min-w-0 flex-1 truncate">{busy ? "Reading colours…" : ref ? ref.name : "Choose a PDF or an image to match"}</span>
            <span className="ps-btn ps-btn-xs">Browse</span>
            <input ref={fileRef} type="file" className="sr-only" accept=".pdf,application/pdf,image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => void pickFile(e.target.files?.[0])} aria-label="Reference file" />
          </label>
          {error ? (
            <p className="ps-caption text-[var(--ps-danger)]" role="alert">
              {error}
            </p>
          ) : null}
          {ref ? (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex gap-1.5" aria-label="Colours found">
                {ref.palette.map((c) => (
                  <span key={c} className="size-6 rounded-full ring-1 ring-[var(--ps-line-2)]" style={{ background: c }} title={c} />
                ))}
              </div>
              <p className="ps-caption">
                Matched to the {THEMES[ref.themeId].name} theme with accent {ref.accent.toUpperCase()}. Adjust below.
              </p>
            </div>
          ) : (
            <p className="ps-caption">The colours of the file pick the closest theme and set your accent. Word documents and other formats are not read for style.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
