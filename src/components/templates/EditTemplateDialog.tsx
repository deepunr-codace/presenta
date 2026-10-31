"use client";

import { useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TEMPLATE_CATEGORIES, updateTemplate, type TemplateCategory, type TemplateEntry } from "@/lib/templates";

type Props = {
  template: TemplateEntry;
  onClose: () => void;
  onSaved: (template: TemplateEntry) => void;
};

/** Rename a template of mine, or change its description and category. */
export function EditTemplateDialog({ template, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(template.title);
  const [description, setDescription] = useState(template.description);
  const [category, setCategory] = useState<TemplateCategory>(template.category);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = title.trim() !== template.title || description.trim() !== template.description || category !== template.category;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!dirty || busy) return;
    setBusy(true);
    setError(null);
    try {
      onSaved(await updateTemplate(template.id, { title: title.trim(), description: description.trim(), category }));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change the template.");
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent style={{ maxWidth: "min(30rem, calc(100% - 2rem))" }}>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Edit template</DialogTitle>
            <DialogDescription>Change how it shows in the gallery. Decks already made from it stay as they are.</DialogDescription>
          </DialogHeader>
          <div className="ps-auth-field">
            <label htmlFor="edit-tpl-title" className="ps-label">Title</label>
            <input id="edit-tpl-title" className="ps-input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} required />
          </div>
          <div className="ps-auth-field">
            <label htmlFor="edit-tpl-desc" className="ps-label">
              Description <span className="ps-caption">optional</span>
            </label>
            <textarea id="edit-tpl-desc" className="ps-input" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={240} rows={2} />
          </div>
          <div className="ps-auth-field">
            <label htmlFor="edit-tpl-category" className="ps-label">Category</label>
            <select id="edit-tpl-category" className="ps-input" value={category} onChange={(e) => setCategory(e.target.value as TemplateCategory)}>
              {TEMPLATE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          {error ? (
            <p className="ps-caption" role="alert" style={{ color: "var(--ps-danger)" }}>{error}</p>
          ) : null}
          <DialogFooter>
            <button type="button" className="ps-btn" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="ps-btn ps-btn-primary" disabled={!dirty || busy || !title.trim()}>{busy ? "Saving…" : "Save changes"}</button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
