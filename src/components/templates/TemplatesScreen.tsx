"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Globe, Presentation, Trash, UploadSimple, UsersThree, Lock } from "@phosphor-icons/react";
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
import { saveDeck } from "@/lib/persist";
import { fetchTeams, type TeamSummary } from "@/lib/collab";
import { deleteTemplate, fetchTemplates, startFromTemplate, updateTemplate, type TemplateEntry, type TemplateScope } from "@/lib/templates";
import { CATEGORIES, TEMPLATES, type Template } from "./templates-data";
import { UploadTemplateDialog } from "./UploadTemplateDialog";

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
  const [confirmId, setConfirmId] = useState<string | null>(null);
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
      setConfirmId(null);
    }
  };

  /** "personal", "global", or "team:<id>". Publishing to one team replaces the previous list. */
  const changeVisibility = async (t: TemplateEntry, value: string) => {
    setBusyId(t.id);
    try {
      const next =
        value === "personal" || value === "global"
          ? await updateTemplate(t.id, { scope: value })
          : await updateTemplate(t.id, { scope: "team", teamIds: [value.slice(5)] });
      setSaved((prev) => (prev ?? []).map((x) => (x.id === t.id ? next : x)));
      toast("Visibility updated.", { tone: "success" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change who can use this template.");
    } finally {
      setBusyId(null);
    }
  };

  /** The current value of the visibility picker: a template can be in several teams, so the first one is shown. */
  const visibilityValue = (t: TemplateEntry) => (t.scope === "team" ? `team:${t.teamIds[0] ?? ""}` : t.scope);

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
              {shownDesigned.map((t) => {
                const cover = t.deck.slides[0];
                const theme = THEMES[t.deck.themeId];
                const busy = busyDesignedId === t.id;
                return (
                  <li key={t.id}>
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
                  </li>
                );
              })}
            </ul>
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
              <PillTabs className="ml-auto" variant="segmented" items={SCOPE_TABS} value={scopeFilter} onChange={setScopeFilter} ariaLabel="Who can use it" />
            </div>

            {shownSaved.length ? (
              <ul className="ps-tpl-grid" aria-label="Saved templates">
                {shownSaved.map((t) => {
                  const [from, to] = swatchOf(t.themeId);
                  const busy = busyId === t.id;
                  return (
                    <li key={t.id} className="ps-tpl-cell">
                      <button
                        type="button"
                        className="ps-tpl"
                        onClick={() => void openSaved(t)}
                        disabled={busy}
                        aria-label={`Use the ${t.title} template`}
                      >
                        <span className="ps-tpl-art" style={{ background: `linear-gradient(135deg, ${from}, ${to})` }} aria-hidden>
                          <span className="ps-tpl-scope" data-scope={t.scope} title={t.teamNames.join(", ") || undefined}>
                            <ScopeIcon scope={t.scope} />
                            {scopeBadge(t)}
                          </span>
                          <span className="ps-tpl-slide">
                            <span className="ps-tpl-icon">
                              <Presentation weight="fill" />
                            </span>
                            <i style={{ width: "58%" }} />
                            <i style={{ width: "82%" }} />
                            <i style={{ width: "44%" }} />
                          </span>
                          <span className="ps-tpl-count">{t.slideCount} slides</span>
                        </span>
                        <span className="ps-tpl-body">
                          <span className="ps-tpl-cat">{t.category}</span>
                          <span className="ps-tpl-title">{t.title}</span>
                          <span className="ps-tpl-desc">{t.description || `Saved by ${t.ownerName}.`}</span>
                          <span className="ps-tpl-use">
                            {busy ? "Opening…" : "Use template"} <ArrowRight size={14} weight="bold" aria-hidden />
                          </span>
                        </span>
                      </button>

                      <div className="ps-tpl-owner">
                        <span className="ps-caption min-w-0 flex-1 truncate">{t.isMine ? "Yours" : `Shared by ${t.ownerName}`}</span>
                        {t.isMine ? (
                          <>
                            <select
                              className="ps-select-xs"
                              aria-label={`Who can use ${t.title}`}
                              value={visibilityValue(t)}
                              disabled={busy}
                              onChange={(e) => void changeVisibility(t, e.target.value)}
                            >
                              <option value="personal">Personal</option>
                              {t.scope === "team" && !t.teamIds.length ? <option value="team:">Team · no team</option> : null}
                              {teams.map((team) => (
                                <option key={team.id} value={`team:${team.id}`}>
                                  Team · {team.name}
                                </option>
                              ))}
                              {t.scope === "team" && t.teamIds[0] && !teams.some((team) => team.id === t.teamIds[0]) ? (
                                <option value={`team:${t.teamIds[0]}`}>Team · {t.teamNames[0] ?? "former team"}</option>
                              ) : null}
                              <option value="global">Global</option>
                            </select>
                            {confirmId === t.id ? (
                              <button type="button" className="ps-btn ps-btn-xs" data-danger="true" disabled={busy} onClick={() => void remove(t)}>
                                Delete
                              </button>
                            ) : (
                              <button type="button" className="ps-iconbtn ps-iconbtn-xs" aria-label={`Delete ${t.title}`} title="Delete template" onClick={() => setConfirmId(t.id)}>
                                <Trash size={12} />
                              </button>
                            )}
                          </>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="ps-body">No saved templates in this category. Upload one, or pick another filter.</p>
            )}
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
              {shownBuiltIn.map((t) => (
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
    </AppShell>
  );
}
