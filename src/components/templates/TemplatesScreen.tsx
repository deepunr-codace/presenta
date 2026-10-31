"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Globe, UploadSimple, UsersThree, Lock } from "@phosphor-icons/react";
import { AppShell } from "@/components/shell/AppShell";
import { useToast } from "@/components/shell/Toast";
import { cloneDeck, seedWizardFromPrompt } from "@/components/home/home-data";
import { useWizardStore } from "@/components/wizard/wizard-state";
import { PillTabs } from "@/components/ui-kit/PillTabs";
import { ErrorNotice } from "@/components/ui-kit/ErrorNotice";
import { FitSlide } from "@/components/canvas/FitSlide";
import { THEMES } from "@/lib/deck/themes";
import { TEMPLATE_DECKS, type TemplateDeckDef } from "@/lib/deck/template-decks";
import { STUDIO_PACKS } from "@/lib/deck/studio-packs";

const ALL_DESIGNED_DECKS: TemplateDeckDef[] = [...TEMPLATE_DECKS, ...STUDIO_PACKS];
import type { ThemeId } from "@/lib/deck/schema";
import { fitForSave, saveDeck } from "@/lib/persist";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fetchTeams, type TeamSummary } from "@/lib/collab";
import { createTemplate, deleteTemplate, fetchTemplates, startFromTemplate, updateTemplate, type TemplateEntry, type TemplateScope } from "@/lib/templates";
import { CATEGORIES, TEMPLATES, type Template } from "./templates-data";
import { EditTemplateDialog } from "./EditTemplateDialog";
import { TemplateCardMenu } from "./TemplateCardMenu";
import { UploadTemplateDialog } from "./UploadTemplateDialog";

/** Cards shown per section before "Load more"; each press shows this many more. */
const PAGE = { core: 6, network: 6, starters: 8 } as const;
type Section = keyof typeof PAGE;

function LoadMore({ shown, total, onMore }: { shown: number; total: number; onMore: () => void }) {
  if (shown >= total) return null;
  return (
    <div className="mt-5 flex justify-center">
      <button type="button" className="ps-btn ps-btn-xs" onClick={onMore}>
        Load more <span className="ps-caption">{total - shown} left</span>
      </button>
    </div>
  );
}

const TABS = CATEGORIES.map((c) => ({ id: c, label: c }));

const SCOPE_TABS = [
  { id: "all", label: "All" },
  { id: "personal", label: "Personal" },
  { id: "team", label: "Team" },
  { id: "global", label: "Global" },
];

/** Category from `?category=` in the URL, else "All". The sidebar's Templates shortcuts deep-link here. */
function categoryFromParam(value: string | null): string {
  return value && (CATEGORIES as readonly string[]).includes(value) ? value : "All";
}

/** The two colours of a saved template's card, from the deck's theme. */
function swatchOf(themeId: string): [string, string] {
  return THEMES[themeId as ThemeId]?.swatch ?? ["#0447FF", "#7C3AED"];
}

function scopeBadge(t: TemplateEntry): string {
  if (t.scope === "personal") return "Personal";
  if (t.scope === "global") return "Global";
  const names = t.teamNames.length ? t.teamNames : ["Team"];
  return names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`;
}

const ScopeIcon = ({ scope }: { scope: TemplateScope }) => {
  if (scope === "global") return <Globe size={11} weight="bold" aria-hidden />;
  if (scope === "team") return <UsersThree size={11} weight="bold" aria-hidden />;
  return <Lock size={11} weight="bold" aria-hidden />;
};

/**
 * Template gallery at /templates: the built-in starters seed the wizard, and decks uploaded to the library (by me, my
 * teams, or anyone) open as a fresh copy in the editor.
 */
export function TemplatesScreen() {
  const router = useRouter();
  const search = useSearchParams();
  const { toast } = useToast();
  // The URL owns the category, so the sidebar's Templates shortcuts can deep-link straight to one.
  const category = categoryFromParam(search.get("category"));

  const [saved, setSaved] = useState<TemplateEntry[] | null>(null);
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [scopeFilter, setScopeFilter] = useState("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<TemplateEntry | null>(null);
  const [editing, setEditing] = useState<TemplateEntry | null>(null);
  const [limits, setLimits] = useState<Record<Section, number>>({ ...PAGE });
  const more = (k: Section) => setLimits((l) => ({ ...l, [k]: l[k] + PAGE[k] }));
  const [busyDesignedId, setBusyDesignedId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchTemplates()
      .then((list) => {
        if (alive) setSaved(list);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setSaved([]);
        setError(err instanceof Error ? err.message : "Could not load your templates.");
      });
    // Only needed for the visibility picker on my own templates.
    fetchTeams()
      .then((r) => {
        if (alive) setTeams(r.teams);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const choose = (id: string) => {
    setLimits({ ...PAGE });
    router.replace(id === "All" ? "/templates" : `/templates?category=${encodeURIComponent(id)}`, { scroll: false });
  };

  const shownBuiltIn = useMemo(() => (category === "All" ? TEMPLATES : TEMPLATES.filter((t) => t.category === category)), [category]);
  const shownDesigned = useMemo(() => (category === "All" ? ALL_DESIGNED_DECKS : ALL_DESIGNED_DECKS.filter((t) => t.category === category)), [category]);
  const shownSaved = useMemo(
    () =>
      (saved ?? []).filter(
        (t) => (category === "All" || t.category === category) && (scopeFilter === "all" || t.scope === scopeFilter),
      ),
    [saved, category, scopeFilter],
  );

  const openStarter = (t: Template) => {
    seedWizardFromPrompt(t.prompt);
    useWizardStore.getState().patchSettings({ slideCount: t.slides });
    router.push("/new");
  };

  const openDesigned = async (t: TemplateDeckDef) => {
    setBusyDesignedId(t.id);
    setError(null);
    try {
      const deck = cloneDeck(t.deck, t.title);
      await saveDeck(deck);
      router.push(`/deck/${deck.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start a deck from this template.");
      setBusyDesignedId(null);
    }
  };

  const openSaved = async (t: TemplateEntry) => {
    setBusyId(t.id);
    setError(null);
    try {
      const { deckId } = await startFromTemplate(t.id);
      router.push(`/edit/${encodeURIComponent(deckId)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start a deck from this template.");
      setBusyId(null);
    }
  };

  const remove = async (t: TemplateEntry) => {
    setBusyId(t.id);
    try {
      await deleteTemplate(t.id);
      setSaved((prev) => (prev ?? []).filter((x) => x.id !== t.id));
      toast("Template deleted.", { tone: "success" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the template.");
    } finally {
      setBusyId(null);
      setDeleting(null);
    }
  };

  /** Keep a copy of a built-in deck in my library, as a personal template. */
  const saveCopy = async (t: TemplateDeckDef) => {
    setError(null);
    try {
      const template = await createTemplate({ title: t.title, description: "", category: t.category as TemplateEntry["category"], scope: "personal", deck: await fitForSave(cloneDeck(t.deck, t.title)) });
      setSaved((prev) => [template, ...(prev ?? [])]);
      toast("Saved to your templates.", { tone: "success" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the template.");
    }
  };

  /** Edits answer without the cover, so the card keeps the one it already has. */
  const replaceSaved = (next: TemplateEntry) => setSaved((prev) => (prev ?? []).map((x) => (x.id === next.id ? { ...next, cover: next.cover ?? x.cover } : x)));

  /** "personal", "global", or "team:<id>". Publishing to one team replaces the previous list. */
  const changeVisibility = async (t: TemplateEntry, value: string) => {
    setBusyId(t.id);
    try {
      const next =
        value === "personal" || value === "global"
          ? await updateTemplate(t.id, { scope: value })
          : await updateTemplate(t.id, { scope: "team", teamIds: [value.slice(5)] });
      replaceSaved(next);
      toast("Visibility updated.", { tone: "success" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change who can use this template.");
    } finally {
      setBusyId(null);
    }
  };


  return (
    <AppShell active="templates" sidebar="full" breadcrumbs={[{ label: "Studio", href: "/" }, { label: "Templates" }]}>
      <div className="ps-page">
        <header className="ps-page-hero mb-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="min-w-0">
            <h1 className="ps-heading">Templates</h1>
            <p className="ps-body-lg mt-2">Start from a proven structure. Built-in starters open the wizard with the brief filled in; saved templates open as a fresh deck you can edit.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PillTabs variant="segmented" items={TABS} value={category} onChange={choose} ariaLabel="Template category" />
            <button type="button" className="ps-btn ps-btn-primary ps-btn-xs" onClick={() => setUploading(true)}>
              <UploadSimple size={12} /> Upload template
            </button>
          </div>
        </header>

        {error ? <ErrorNotice compact className="mb-6" message={error} /> : null}

        {/* Designed templates: real pre-built decks, not AI prompts. Picking one just clones the finished deck. */}
        {shownDesigned.length ? (
          <section className="mb-10" aria-label="Core library">
            <h2 className="ps-cardtitle mb-4">Core Library</h2>
            <ul className="ps-tpl-grid" aria-label="Designed templates">
              {shownDesigned.slice(0, limits.core).map((t) => {
                const cover = t.deck.slides[0];
                const theme = THEMES[t.deck.themeId];
                const busy = busyDesignedId === t.id;
                return (
                  <li key={t.id} className="ps-tpl-item">
                    <button type="button" className="ps-tpl" onClick={() => void openDesigned(t)} disabled={busy} aria-label={`Use the ${t.title} template`}>
                      <span className="ps-tpl-art" aria-hidden>
                        <FitSlide slide={cover} theme={theme} className="pointer-events-none" />
                        <span className="ps-tpl-count">{t.deck.slides.length} slides</span>
                      </span>
                      <span className="ps-tpl-body">
                        <span className="ps-tpl-cat">{t.category}</span>
                        <span className="ps-tpl-title">{t.title}</span>
                        <span className="ps-tpl-use">
                          {busy ? "Opening…" : "Use template"} <ArrowRight size={14} weight="bold" aria-hidden />
                        </span>
                      </span>
                    </button>
                    <TemplateCardMenu title={t.title} onUse={() => void openDesigned(t)} onSaveCopy={() => void saveCopy(t)} />
                  </li>
                );
              })}
            </ul>
            <LoadMore shown={limits.core} total={shownDesigned.length} onMore={() => more("core")} />
          </section>
        ) : null}

        {/* Saved templates: mine, my teams' and the global library */}
        {saved === null ? (
          <section className="mb-10" aria-hidden>
            <div className="ps-skeleton mb-4 h-5 w-40 rounded-full" />
            <ul className="ps-tpl-grid">
              {[0, 1, 2].map((i) => (
                <li key={i}>
                  <div className="ps-glass h-64 animate-pulse" />
                </li>
              ))}
            </ul>
          </section>
        ) : saved.length ? (
          <section className="mb-10" aria-label="Template network">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <h2 className="ps-cardtitle">Template Network</h2>
              <span className="ps-caption">
                {saved.length} {saved.length === 1 ? "template" : "templates"}
              </span>
              <PillTabs className="ml-auto" variant="segmented" items={SCOPE_TABS} value={scopeFilter} onChange={(id) => {
                  setScopeFilter(id);
                  setLimits((l) => ({ ...l, network: PAGE.network }));
                }} ariaLabel="Who can use it" />
            </div>

            {shownSaved.length ? (
              <ul className="ps-tpl-grid" aria-label="Saved templates">
                {shownSaved.slice(0, limits.network).map((t) => {
                  const [from, to] = swatchOf(t.themeId);
                  const theme = THEMES[t.themeId as ThemeId];
                  const busy = busyId === t.id;
                  return (
                    <li key={t.id} className="ps-tpl-item">
                      <button type="button" className="ps-tpl" onClick={() => void openSaved(t)} disabled={busy} aria-label={`Use the ${t.title} template`}>
                        <span className="ps-tpl-art" style={{ background: `linear-gradient(135deg, ${from}, ${to})` }} aria-hidden>
                          {t.cover && theme ? <FitSlide slide={t.cover} theme={theme} className="pointer-events-none" /> : null}
                          <span className="ps-tpl-scope" data-scope={t.scope} title={t.teamNames.join(", ") || undefined}>
                            <ScopeIcon scope={t.scope} />
                            {scopeBadge(t)}
                          </span>
                          <span className="ps-tpl-count">{t.slideCount} slides</span>
                        </span>
                        <span className="ps-tpl-body">
                          <span className="ps-tpl-cat">{t.category}</span>
                          <span className="ps-tpl-title">{t.title}</span>
                          <span className="ps-tpl-desc">{t.description || (t.isMine ? "Yours" : `Shared by ${t.ownerName}`)}</span>
                          <span className="ps-tpl-use">
                            {busy ? "Working…" : "Use template"} <ArrowRight size={14} weight="bold" aria-hidden />
                          </span>
                        </span>
                      </button>
                      <TemplateCardMenu
                        title={t.title}
                        onUse={() => void openSaved(t)}
                        sharedBy={t.isMine ? undefined : t.ownerName}
                        mine={t.isMine ? { template: t, teams, onEdit: () => setEditing(t), onVisibility: (v) => void changeVisibility(t, v), onDelete: () => setDeleting(t) } : undefined}
                      />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="ps-body">No saved templates in this category. Upload one, or pick another filter.</p>
            )}
            <LoadMore shown={limits.network} total={shownSaved.length} onMore={() => more("network")} />
          </section>
        ) : (
          <section className="mb-10" aria-label="Template network">
            <div className="ps-glass flex flex-wrap items-center gap-4" data-paper>
              <div className="min-w-0 flex-1">
                <h2 className="ps-cardtitle">Bring your own template</h2>
                <p className="ps-body mt-1">Turn a deck you already like into a starting point: keep it to yourself, share it with your teams, or publish it for everyone.</p>
              </div>
              <button type="button" className="ps-btn ps-btn-xs" onClick={() => setUploading(true)}>
                <UploadSimple size={12} /> Upload a deck
              </button>
            </div>
          </section>
        )}

        {/* Built-in starters: no real artwork, so these are compact icon cards rather than thumbnail tiles. */}
        <section aria-label="Quick starters">
          <h2 className="ps-cardtitle mb-4">Quick Starters</h2>
          {shownBuiltIn.length ? (
            <ul className="ps-starter-grid" aria-label="Templates">
              {shownBuiltIn.slice(0, limits.starters).map((t) => (
                <li key={t.id}>
                  <button type="button" className="ps-starter" onClick={() => openStarter(t)} aria-label={`Use the ${t.title} template`}>
                    <span className="ps-starter-icon" style={{ background: `linear-gradient(135deg, ${t.tint[0]}, ${t.tint[1]})` }} aria-hidden>
                      {t.icon}
                    </span>
                    <span className="ps-starter-title">{t.title}</span>
                    <span className="ps-starter-desc">{t.description}</span>
                    <span className="ps-starter-foot">
                      <span className="ps-starter-cat">{t.category}</span>
                      <span className="ps-starter-count">{t.slides} slides</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ps-body">No built-in starters in this category.</p>
          )}
          <LoadMore shown={limits.starters} total={shownBuiltIn.length} onMore={() => more("starters")} />
        </section>
      </div>

      {uploading ? (
        <UploadTemplateDialog
          onClose={() => setUploading(false)}
          onCreated={(template) => {
            setSaved((prev) => [template, ...(prev ?? [])]);
            toast("Template published.", { tone: "success" });
          }}
        />
      ) : null}

      {editing ? (
        <EditTemplateDialog
          template={editing}
          onClose={() => setEditing(null)}
          onSaved={(next) => {
            replaceSaved(next);
            toast("Template updated.", { tone: "success" });
          }}
        />
      ) : null}

      {deleting ? (
        <Dialog open onOpenChange={(open) => !open && busyId !== deleting.id && setDeleting(null)}>
          <DialogContent style={{ maxWidth: "min(26rem, calc(100% - 2rem))" }}>
            <DialogHeader>
              <DialogTitle>Delete this template?</DialogTitle>
              <DialogDescription>
                &ldquo;{deleting.title}&rdquo; is removed from the library for everyone who can see it. Decks already made from it are not affected.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <button type="button" className="ps-btn" onClick={() => setDeleting(null)} disabled={busyId === deleting.id}>Cancel</button>
              <button type="button" className="ps-btn" data-danger="true" onClick={() => void remove(deleting)} disabled={busyId === deleting.id}>
                {busyId === deleting.id ? "Deleting…" : "Delete template"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </AppShell>
  );
}
