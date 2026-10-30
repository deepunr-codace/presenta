"use client";

import { useEffect, useState, type FormEvent } from "react";
import { FileText, MagnifyingGlass } from "@phosphor-icons/react";
import { importNotionPage, searchNotionPages, type NotionPage } from "@/lib/collab";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useWizardStore } from "./wizard-state";

type Props = { open: boolean; onOpenChange: (open: boolean) => void };

export function NotionImportDialog({ open, onOpenChange }: Props) {
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [pages, setPages] = useState<NotionPage[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true); setError(null);
    searchNotionPages(appliedQuery).then((items) => { if (alive) setPages(items); })
      .catch((e: unknown) => { if (alive) setError(e instanceof Error ? e.message : "Could not search Notion."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [open, appliedQuery]);

  const search = (e: FormEvent) => { e.preventDefault(); setAppliedQuery(query.trim()); };
  const choose = async (page: NotionPage) => {
    setBusyId(page.id); setError(null);
    try {
      const imported = await importNotionPage(page.id);
      const current = useWizardStore.getState().paste.text.trimEnd();
      useWizardStore.getState().patchPaste({ text: `${current ? `${current}\n\n` : ""}${imported.text}`.slice(0, 40000) });
      onOpenChange(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not import that Notion page."); }
    finally { setBusyId(null); }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><FileText size={19} /> Import from Notion</DialogTitle>
        <DialogDescription>Choose a page shared with your Notion integration. Its text is added to the brief source.</DialogDescription>
      </DialogHeader>
      <form className="flex gap-2" onSubmit={search}>
        <label className="sr-only" htmlFor="notion-page-search">Search Notion pages</label>
        <input id="notion-page-search" className="ps-input min-w-0 flex-1" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search pages…" />
        <button type="submit" className="ps-btn ps-btn-xs" disabled={loading}><MagnifyingGlass size={13} /> Search</button>
      </form>
      {error ? <div className="ps-caption" role="alert" style={{ color: "var(--ps-danger)" }}>{error}{error.includes("Connect Notion") ? <a className="ps-link ml-1" href="/integrations">Open Integrations</a> : null}</div> : null}
      <div className="max-h-[48vh] overflow-y-auto">
        {loading ? <p className="ps-body py-8 text-center">Searching Notion…</p> : pages.length ? <ul className="flex flex-col gap-1">{pages.map((page) => <li key={page.id}>
          <button type="button" className="w-full rounded-lg px-3 py-2 text-left hover:bg-[var(--ps-plate)] disabled:opacity-60" disabled={Boolean(busyId)} onClick={() => void choose(page)}>
            <span className="block text-[13px] font-medium">{busyId === page.id ? "Importing…" : page.title}</span>
            <span className="ps-caption">{page.editedAt ? `Edited ${new Date(page.editedAt).toLocaleDateString()}` : "Notion page"}</span>
          </button>
        </li>)}</ul> : !error ? <p className="ps-body py-8 text-center">No pages found. Share pages with your integration in Notion first.</p> : null}
      </div>
    </DialogContent>
  </Dialog>;
}
