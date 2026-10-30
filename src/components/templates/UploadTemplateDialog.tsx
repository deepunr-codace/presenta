"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Check, FileArrowUp, UploadSimple, UsersThree } from "@phosphor-icons/react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Deck } from "@/lib/deck/schema";
import { fetchTeams, type TeamSummary } from "@/lib/collab";
import { importDeckFile, listDecks, type DeckSummary } from "@/lib/persist";
import {
  TEMPLATE_CATEGORIES,
  TEMPLATE_SCOPE_LABEL,
  createTemplate,
  type NewTemplateInput,
  type TemplateCategory,
  type TemplateEntry,
  type TemplateScope,
} from "@/lib/templates";

type Props = {
  onClose: () => void;
  onCreated: (template: TemplateEntry) => void;
};

/** The order the scope cards are shown in, and what each one means. */
const SCOPES: { id: TemplateScope; title: string; hint: string }[] = [
  { id: "personal", title: TEMPLATE_SCOPE_LABEL.personal, hint: "Only you can see and use it." },
  { id: "team", title: "My teams", hint: "Anyone in the teams you pick can use it." },
  { id: "global", title: TEMPLATE_SCOPE_LABEL.global, hint: "Everyone signed in to Presenta can use it." },
];

/**
 * Publish a deck to the templates library: from one of my saved decks or from an exported deck file, with a title,
 * a category and a scope (just me, my teams, or everyone).
 */
export function UploadTemplateDialog({ onClose, onCreated }: Props) {
  const [source, setSource] = useState<"deck" | "file">("deck");
  const [decks, setDecks] = useState<DeckSummary[] | null>(null);
  const [deckId, setDeckId] = useState("");
  const [fileDeck, setFileDeck] = useState<Deck | null>(null);
  const [fileName, setFileName] = useState("");
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TemplateCategory>("Business");
  const [scope, setScope] = useState<TemplateScope>("personal");
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // My decks and my teams, for the two pickers.
  useEffect(() => {
    let alive = true;
    Promise.all([listDecks(), fetchTeams().catch(() => ({ teams: [] as TeamSummary[], invites: [] }))])
      .then(([list, t]) => {
        if (!alive) return;
        setDecks(list);
        setDeckId((id) => id || list[0]?.id || "");
        setTeams(t.teams);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setDecks([]);
        setError(err instanceof Error ? err.message : "Could not load your decks.");
      });
    return () => {
      alive = false;
    };
  }, []);

  const chosenDeck = decks?.find((d) => d.id === deckId);

  const pickDeck = (id: string) => {
    setDeckId(id);
    const deck = decks?.find((d) => d.id === id);
    if (deck) setTitle((t) => (t.trim() ? t : deck.title));
  };

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setFileDeck(null);
    setFileName(file.name);
    try {
      const deck = await importDeckFile(file);
      setFileDeck(deck);
      setTitle((t) => (t.trim() ? t : deck.title));
    } catch (err) {
      setFileName("");
      setError(err instanceof Error ? err.message : "That file could not be read.");
    }
  };

  const toggleTeam = (id: string) => setTeamIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const ready = source === "deck" ? Boolean(deckId) : Boolean(fileDeck);
  const canSubmit = ready && !busy && (scope !== "team" || teamIds.length > 0);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const input: NewTemplateInput = {
        title,
        description,
        category,
        scope,
        ...(scope === "team" ? { teamIds } : {}),
        ...(source === "deck" ? { deckId } : { deck: fileDeck }),
      };
      onCreated(await createTemplate(input));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The template could not be published.");
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent style={{ maxWidth: "min(34rem, calc(100% - 2rem))" }}>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Upload a template</DialogTitle>
            <DialogDescription>
              Turn a deck you already like into a starting point. A deck made from it is a fresh copy, so nothing here changes later.
            </DialogDescription>
          </DialogHeader>

          {/* Where the deck comes from */}
          <div className="ps-seg" role="group" aria-label="Template source">
            <button type="button" className="ps-seg-item" aria-pressed={source === "deck"} onClick={() => setSource("deck")}>
              From my decks
            </button>
            <button type="button" className="ps-seg-item" aria-pressed={source === "file"} onClick={() => setSource("file")}>
              From a file
            </button>
          </div>

          {source === "deck" ? (
            <div className="ps-auth-field">
              <label htmlFor="tpl-deck" className="ps-label">
                Deck
              </label>
              <select id="tpl-deck" className="ps-input" value={deckId} onChange={(e) => pickDeck(e.target.value)} disabled={decks === null}>
                {decks === null ? <option value="">Loading your decks…</option> : null}
                {decks?.length === 0 ? <option value="">No saved decks yet</option> : null}
                {decks?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title} · {d.slideCount} {d.slideCount === 1 ? "slide" : "slides"}
                  </option>
                ))}
              </select>
              {decks && decks.length === 0 ? <p className="ps-caption mt-1">Create a deck first, or upload an exported deck file instead.</p> : null}
            </div>
          ) : (
            <div className="ps-auth-field">
              <span className="ps-label">Deck file</span>
              <label className="ps-upload-drop" data-filled={fileDeck ? "true" : undefined}>
                {fileDeck ? <FileArrowUp size={18} /> : <UploadSimple size={18} />}
                <span className="min-w-0 flex-1 truncate">
                  {fileDeck ? `${fileName} · ${fileDeck.slides.length} ${fileDeck.slides.length === 1 ? "slide" : "slides"}` : "Choose a deck JSON file"}
                </span>
                <span className="ps-btn ps-btn-xs">Browse</span>
                <input type="file" className="sr-only" accept=".json,application/json" onChange={(e) => void pickFile(e.target.files?.[0])} aria-label="Deck file" />
              </label>
              <p className="ps-caption mt-1">Export any deck as JSON from Decks → ⋯ → Export, then pick that file here.</p>
            </div>
          )}

          {/* What the gallery shows */}
          <div className="ps-auth-field">
            <label htmlFor="tpl-title" className="ps-label">
              Title
            </label>
            <input
              id="tpl-title"
              className="ps-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={chosenDeck?.title ?? fileDeck?.title ?? "Quarterly review"}
              maxLength={80}
            />
          </div>

          <div className="ps-auth-field">
            <label htmlFor="tpl-desc" className="ps-label">
              Description <span className="ps-caption">optional</span>
            </label>
            <textarea
              id="tpl-desc"
              className="ps-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this template is good for, in one line."
              maxLength={240}
              rows={2}
            />
          </div>

          <div className="ps-auth-field">
            <label htmlFor="tpl-category" className="ps-label">
              Category
            </label>
            <select id="tpl-category" className="ps-input" value={category} onChange={(e) => setCategory(e.target.value as TemplateCategory)}>
              {TEMPLATE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Who can use it */}
          <div className="ps-auth-field">
            <span className="ps-label">Who can use it</span>
            <div className="ps-scope-grid" role="radiogroup" aria-label="Who can use this template">
              {SCOPES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={scope === s.id}
                  className="ps-scope-card"
                  data-active={scope === s.id ? "" : undefined}
                  onClick={() => setScope(s.id)}
                >
                  <span className="ps-scope-title">
                    {s.title}
                    {scope === s.id ? <Check size={13} weight="bold" aria-hidden /> : null}
                  </span>
                  <span className="ps-caption">{s.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {scope === "team" ? (
            teams.length ? (
              <fieldset className="ps-auth-field">
                <legend className="ps-label mb-2">Publish to</legend>
                <ul className="flex flex-col gap-1">
                  {teams.map((t) => (
                    <li key={t.id}>
                      <label className="ps-check">
                        <input type="checkbox" checked={teamIds.includes(t.id)} onChange={() => toggleTeam(t.id)} />
                        <UsersThree size={14} aria-hidden />
                        <span className="min-w-0 flex-1 truncate">{t.name}</span>
                        <span className="ps-caption">
                          {t.memberCount} {t.memberCount === 1 ? "member" : "members"}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            ) : (
              <p className="ps-caption">You are not in a team yet. Create one on the Teams page, then publish to it.</p>
            )
          ) : null}

          {error ? (
            <p className="ps-caption" role="alert" style={{ color: "var(--ps-danger)" }}>
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <button type="button" className="ps-btn" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="ps-btn ps-btn-primary" disabled={!canSubmit}>
              {busy ? "Publishing…" : "Publish template"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
