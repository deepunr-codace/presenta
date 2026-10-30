"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { ArrowRight, CaretRight, FolderOpen, FolderPlus, HardDrives, ListBullets, MagnifyingGlass, Plus, Sparkle, SquaresFour, UploadSimple } from "@phosphor-icons/react";
import { fetchSharedDecks, fetchTeams, type SharedDeck, type TeamSummary } from "@/lib/collab";
import { SAMPLE_DECK } from "@/lib/deck/sample";
import { childrenOf, createFolder, deleteFolder, fetchFolders, fetchStorage, moveDeckToFolder, moveFolder, pathLabel, pathTo, renameFolder, type Folder, type StorageUsage } from "@/lib/drive";
import { listDecks, saveDeck, type DeckSummary } from "@/lib/persist";
import { useStarred } from "@/hooks/useStarred";
import { ShareDialog } from "@/components/editor/ShareDialog";
import { AppShell } from "@/components/shell/AppShell";
import { useToast } from "@/components/shell/Toast";
import { DeckCard } from "@/components/home/DeckCard";
import { DeleteDeckDialog } from "@/components/home/DeleteDeckDialog";
import { EmptyDecksCard } from "@/components/home/EmptyDecksCard";
import { SharedDeckCard } from "@/components/home/SharedDeckCard";
import { StatSkeleton } from "@/components/home/StatSkeleton";
import { cloneDeck } from "@/components/home/home-data";
import { useDeckActions } from "@/components/home/useDeckActions";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorNotice } from "@/components/ui-kit/ErrorNotice";
import { PillTabs } from "@/components/ui-kit/PillTabs";
import { SectionTitle } from "@/components/ui-kit/SectionTitle";
import { timeAgo } from "@/lib/time";
import { DeckListRow } from "./DeckListRow";
import { FolderCard } from "./FolderCard";
import { MoveDialog } from "./MoveDialog";
import { NameDialog } from "./NameDialog";
import { SharingBadge } from "./SharingBadge";
import { StorageMeter } from "./StorageMeter";
import { DECK_DRAG, FOLDER_DRAG } from "./drag";

type Filter = "all" | "mine" | "starred" | "sharedByMe" | "sharedWithMe";
type Sort = "recent" | "oldest" | "name" | "nameDesc" | "slides" | "size";

const GRID = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
/* Folders are smaller tiles than decks, the way a file manager lays them out. */
const FOLDER_GRID = "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6";
const title = (d: { title: string }) => d.title || "Untitled deck";

/** Which dialog is open. Only one at a time. */
type Dialog_ =
  | { kind: "newFolder" }
  | { kind: "rename"; folder: Folder }
  | { kind: "moveFolder"; folder: Folder }
  | { kind: "moveDeck"; deck: DeckSummary }
  | { kind: "deleteFolder"; folder: Folder }
  | { kind: "share"; id: string };

/**
 * /decks: a file-manager view of everything. My decks live in folders (drag a deck onto a folder to file it), each
 * with a Drive-style sharing indicator. Search and the filters (starred, shared by me, shared with me, a team) look
 * across all folders. Grid or list view, and a storage meter for the 100 MB each account gets.
 */
export function DecksScreen() {
  const router = useRouter();
  const search = useSearchParams();
  const { toast } = useToast();
  const starred = useStarred();
  const fileRef = useRef<HTMLInputElement>(null);

  const [decks, setDecks] = useState<DeckSummary[] | null>(null);
  const [shared, setShared] = useState<SharedDeck[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [storage, setStorage] = useState<StorageUsage | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [teamId, setTeamId] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [dialog, setDialog] = useState<Dialog_ | null>(null);

  const view = search.get("v") === "list" ? "list" : "grid";
  const requestedFolder = search.get("f");

  /* ---------- loading ---------- */

  const fetchAll = useCallback(async () => {
    const [decks, folders] = await Promise.all([listDecks(), fetchFolders()]);
    const [shared, teams, storage] = await Promise.all([
      fetchSharedDecks().catch(() => [] as SharedDeck[]),
      fetchTeams().then((r) => r.teams).catch(() => [] as TeamSummary[]),
      fetchStorage().catch(() => null),
    ]);
    return { decks, folders, shared, teams, storage };
  }, []);

  const apply = useCallback((r: Awaited<ReturnType<typeof fetchAll>>) => {
    setDecks(r.decks);
    setFolders(r.folders);
    setShared(r.shared);
    setTeams(r.teams);
    setStorage(r.storage);
    setLoadError(null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      apply(await fetchAll());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not read your decks.");
      setDecks((d) => d ?? []);
    }
  }, [fetchAll, apply]);

  useEffect(() => {
    let alive = true;
    fetchAll()
      .then((r) => alive && apply(r))
      .catch((err: unknown) => {
        if (!alive) return;
        setLoadError(err instanceof Error ? err.message : "Could not read your decks.");
        setDecks([]);
      });
    return () => {
      alive = false;
    };
  }, [fetchAll, apply]);

  const base = useDeckActions(refresh);
  const { busy, error, setError, pendingDelete, setPendingDelete, confirmDelete, importFile } = base;

  /* ---------- where I am ---------- */

  const currentId = requestedFolder && folders.some((f) => f.id === requestedFolder) ? requestedFolder : null;
  const trail = useMemo(() => pathTo(folders, currentId), [folders, currentId]);

  const go = useCallback(
    (folderId: string | null, nextView = view) => {
      const q = new URLSearchParams();
      if (folderId) q.set("f", folderId);
      if (nextView === "list") q.set("v", "list");
      router.push(q.size ? `/decks?${q}` : "/decks");
    },
    [router, view],
  );

  /* ---------- moving things ---------- */

  const moveDeckTo = useCallback(
    async (deckId: string, folderId: string | null, label?: string) => {
      const from = decks?.find((d) => d.id === deckId)?.folderId ?? null;
      await moveDeckToFolder(deckId, folderId);
      await refresh();
      toast(`Moved to ${label ?? (folderId ? (folders.find((f) => f.id === folderId)?.name ?? "the folder") : "My decks")}.`, {
        tone: "success",
        action: { label: "Undo", onClick: () => void moveDeckToFolder(deckId, from).then(refresh).catch(() => undefined) },
      });
    },
    [decks, folders, refresh, toast],
  );

  const moveFolderTo = useCallback(
    async (id: string, parentId: string | null) => {
      await moveFolder(id, parentId);
      await refresh();
      toast("Folder moved.", { tone: "success" });
    },
    [refresh, toast],
  );

  const dropOn = useCallback(
    (kind: "deck" | "folder", id: string, into: Folder | null) => {
      const run = kind === "deck" ? moveDeckTo(id, into?.id ?? null) : moveFolderTo(id, into?.id ?? null);
      run.catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not move it."));
    },
    [moveDeckTo, moveFolderTo, setError],
  );

  const acceptsDrag = (e: DragEvent) => e.dataTransfer.types.includes(DECK_DRAG) || e.dataTransfer.types.includes(FOLDER_DRAG);
  const dropOnCrumb = (e: DragEvent, into: Folder | null) => {
    e.preventDefault();
    const deck = e.dataTransfer.getData(DECK_DRAG);
    const sub = e.dataTransfer.getData(FOLDER_DRAG);
    if (deck) dropOn("deck", deck, into);
    else if (sub && sub !== into?.id) dropOn("folder", sub, into);
  };

  const actions = useMemo(
    () => ({ ...base.actions, onShare: (s: DeckSummary) => setDialog({ kind: "share", id: s.id }), onMove: (s: DeckSummary) => setDialog({ kind: "moveDeck", deck: s }) }),
    [base.actions],
  );

  const openSample = async () => {
    try {
      const deck = cloneDeck(SAMPLE_DECK);
      await saveDeck(deck);
      router.push(`/deck/${deck.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open the sample.");
    }
  };

  /* ---------- what to show ---------- */

  const q = query.trim().toLowerCase();
  const explorer = filter === "all" && !q && !teamId;
  const teamNames = useMemo(() => new Map(teams.map((t) => [t.id, t.name])), [teams]);
  const starredIds = useMemo(() => new Set(starred), [starred]);

  const sortBy = useCallback(
    <T extends { title: string; updatedAt: string; slideCount: number; sizeBytes?: number }>(list: T[]): T[] => {
      const out = [...list];
      const by: Record<Sort, (a: T, b: T) => number> = {
        recent: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
        oldest: (a, b) => a.updatedAt.localeCompare(b.updatedAt),
        name: (a, b) => title(a).localeCompare(title(b)),
        nameDesc: (a, b) => title(b).localeCompare(title(a)),
        slides: (a, b) => b.slideCount - a.slideCount,
        size: (a, b) => (b.sizeBytes ?? 0) - (a.sizeBytes ?? 0),
      };
      return out.sort(by[sort]);
    },
    [sort],
  );

  const isShared = (d: DeckSummary) => Boolean(d.sharing && (d.sharing.people > 0 || d.sharing.teamIds.length > 0 || d.sharing.link === "anyone_view"));

  const myDecks = useMemo(() => {
    const list = (decks ?? []).filter((d) => {
      if (q && !title(d).toLowerCase().includes(q)) return false;
      if (teamId && !d.sharing?.teamIds.includes(teamId)) return false;
      if (filter === "starred" && !starredIds.has(d.id)) return false;
      if (filter === "sharedByMe" && !isShared(d)) return false;
      if (filter === "sharedWithMe") return false;
      if (explorer && (d.folderId ?? null) !== currentId) return false;
      return true;
    });
    return sortBy(list);
  }, [decks, q, teamId, filter, starredIds, explorer, currentId, sortBy]);

  const sharedDecks = useMemo(() => {
    const showHere = filter === "all" || filter === "sharedWithMe";
    if (!showHere) return [];
    if (explorer && currentId) return [];
    return sortBy(shared.filter((d) => (!q || title(d).toLowerCase().includes(q)) && (!teamId || d.teamIds.includes(teamId))));
  }, [shared, filter, explorer, currentId, q, teamId, sortBy]);

  const shownFolders = useMemo(() => {
    if (filter !== "all" && filter !== "mine") return [];
    if (teamId) return [];
    const list = explorer ? childrenOf(folders, currentId) : folders.filter((f) => !q || f.name.toLowerCase().includes(q));
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [folders, filter, teamId, explorer, currentId, q]);

  const loading = decks === null;
  const total = (decks ?? []).length;
  const counts = {
    starred: (decks ?? []).filter((d) => starredIds.has(d.id)).length,
    sharedByMe: (decks ?? []).filter(isShared).length,
  };
  const nothingAtAll = !loading && total === 0 && shared.length === 0 && folders.length === 0;
  const nothingShown = !loading && !nothingAtAll && myDecks.length + sharedDecks.length + shownFolders.length === 0;
  const where = (d: DeckSummary) => pathLabel(folders, d.folderId ?? null) || "My decks";

  const tabs = [
    { id: "all", label: "All" },
    { id: "mine", label: `My decks · ${total}` },
    { id: "starred", label: `Starred · ${counts.starred}` },
    { id: "sharedByMe", label: `Shared by me · ${counts.sharedByMe}` },
    { id: "sharedWithMe", label: `Shared with me · ${shared.length}` },
  ];

  const dragProps = (d: DeckSummary) => ({
    draggable: true,
    onDragStart: (e: DragEvent) => {
      e.dataTransfer.setData(DECK_DRAG, d.id);
      e.dataTransfer.effectAllowed = "move";
    },
  });

  const emptyMessage = q
    ? `Nothing matches “${query.trim()}”.`
    : teamId
      ? "Nothing is shared with this team yet."
      : filter === "starred"
        ? "No starred decks yet. Open a deck's menu and choose Star."
        : filter === "sharedByMe"
          ? "You have not shared any decks yet. Open a deck's menu and choose Share."
          : filter === "sharedWithMe"
            ? "Nothing has been shared with you yet."
            : currentId
              ? "This folder is empty. Drag decks here, or use “Move to folder” in a deck's menu."
              : "Nothing here yet.";

  const disabledForMove = useMemo(() => {
    if (dialog?.kind !== "moveFolder") return undefined;
    const out = new Set([dialog.folder.id]);
    for (let grew = true; grew; ) {
      grew = false;
      for (const f of folders) {
        if (f.parentId && out.has(f.parentId) && !out.has(f.id)) {
          out.add(f.id);
          grew = true;
        }
      }
    }
    return out;
  }, [dialog, folders]);

  return (
    <AppShell
      active="decks"
      sidebar="full"
      breadcrumbs={[{ label: "Studio", href: "/" }, { label: "Decks" }]}
      actions={
        <>
          <button type="button" className="ps-btn ps-btn-xs" onClick={() => fileRef.current?.click()} disabled={busy !== null}>
            <UploadSimple size={12} /> Import
          </button>
          <button type="button" className="ps-btn ps-btn-xs" onClick={() => setDialog({ kind: "newFolder" })}>
            <FolderPlus size={12} /> New folder
          </button>
          <Link href="/new" className="ps-btn ps-btn-primary ps-btn-xs">
            <Plus size={12} weight="bold" /> New deck
          </Link>
        </>
      }
    >
      <div className="ps-page ps-decks-page">
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json,application/vnd.openxmlformats-officedocument.presentationml.presentation,.pptx,application/pdf,.pdf"
          className="hidden"
          aria-hidden
          tabIndex={-1}
          onChange={(e) => {
            importFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />

        <header className="ps-decks-header">
          <div className="ps-decks-intro">
            <span className="ps-decks-eyebrow"><Sparkle size={12} weight="fill" /> YOUR LIBRARY</span>
            <h1 className="ps-heading">Decks</h1>
            <p className="ps-decks-subtitle">A considered home for every story you create.</p>
            <nav aria-label="Folder path" className="ps-decks-path">
              <button
                type="button"
                className="ps-btn ps-btn-xs"
                data-active={!currentId ? "true" : undefined}
                onClick={() => go(null)}
                onDragOver={(e) => acceptsDrag(e) && e.preventDefault()}
                onDrop={(e) => dropOnCrumb(e, null)}
              >
                <HardDrives size={14} weight="light" /> My decks
              </button>
              {trail.map((f) => (
                <span key={f.id} className="flex items-center gap-1">
                  <CaretRight size={12} className="text-[var(--ps-smoke)]" aria-hidden />
                  <button
                    type="button"
                    className="ps-btn ps-btn-xs"
                    aria-current={f.id === currentId ? "page" : undefined}
                    onClick={() => go(f.id)}
                    onDragOver={(e) => acceptsDrag(e) && e.preventDefault()}
                    onDrop={(e) => dropOnCrumb(e, f)}
                  >
                    {f.name}
                  </button>
                </span>
              ))}
            </nav>
          </div>
          {storage ? (
            <Link href="/account#storage" className="ps-decks-storage" title="See what is using your storage">
              <span className="ps-decks-storage-label">LIBRARY STORAGE</span>
              <StorageMeter used={storage.used} limit={storage.limit} compact />
              <span className="ps-decks-storage-hint">Manage storage <ArrowRight size={12} /></span>
            </Link>
          ) : null}
        </header>

        {loadError || error ? <ErrorNotice compact className="mb-4" message={loadError ?? error ?? ""} /> : null}

        <section className="ps-decks-tools" aria-label="Browse your decks">
          <div className="ps-decks-filter-scroll">
            <PillTabs items={tabs} value={filter} onChange={(id) => setFilter(id as Filter)} ariaLabel="Filter decks" className="ps-decks-tabs" />
          </div>
          <div className={`ps-decks-controls ${teams.length ? "has-team" : "no-team"}`}>
            <label className="relative">
              <span className="sr-only">Search decks and folders</span>
              <MagnifyingGlass size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[var(--ps-smoke)]" aria-hidden />
              <input type="search" className="ps-input !pl-8" placeholder="Search decks and folders" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            {teams.length ? (
              <select className="ps-input ps-decks-team-select" value={teamId} onChange={(e) => setTeamId(e.target.value)} aria-label="Filter by team">
                <option value="">All teams</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    Team: {t.name}
                  </option>
                ))}
              </select>
            ) : null}
            <select className="ps-input ps-decks-sort-select" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort by">
              <option value="recent">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name">Name A to Z</option>
              <option value="nameDesc">Name Z to A</option>
              <option value="slides">Most slides</option>
              <option value="size">Largest</option>
            </select>
            <PillTabs
              variant="segmented"
              ariaLabel="View"
              value={view}
              onChange={(id) => go(currentId, id as "grid" | "list")}
              items={[
                { id: "grid", label: <SquaresFour size={14} aria-label="Grid view" /> },
                { id: "list", label: <ListBullets size={14} aria-label="List view" /> },
              ]}
            />
          </div>
        </section>

        {!explorer ? (
          <p className="ps-caption mb-4" role="status">
            Showing results from every folder.{" "}
            <button
              type="button"
              className="ps-link"
              onClick={() => {
                setQuery("");
                setFilter("all");
                setTeamId("");
              }}
            >
              Clear filters
            </button>
          </p>
        ) : null}

        {loading ? (
          <div className={GRID} aria-hidden>
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </div>
        ) : nothingAtAll ? (
          <EmptyDecksCard onSample={() => void openSample()} busy={busy !== null} />
        ) : nothingShown ? (
          <section className="ps-decks-empty" role="status" aria-label="No matching decks">
            <div className="ps-decks-empty-art" aria-hidden><FolderOpen size={27} weight="light" /></div>
            <span className="ps-decks-eyebrow">{currentId && explorer ? "EMPTY FOLDER" : "NOTHING TO SHOW"}</span>
            <h2>{q || teamId || filter !== "all" ? "No decks match this view" : currentId ? "A fresh space for what’s next" : "Your next great story starts here"}</h2>
            <p>{emptyMessage}</p>
            {q || teamId || filter !== "all" ? (
              <button type="button" className="ps-btn ps-btn-primary ps-btn-xs" onClick={() => { setQuery(""); setFilter("all"); setTeamId(""); }}>
                Clear filters <ArrowRight size={13} />
              </button>
            ) : (
              <div className="ps-decks-empty-actions">
                <Link href="/new" className="ps-btn ps-btn-primary ps-btn-xs"><Plus size={13} weight="bold" /> New deck</Link>
                <button type="button" className="ps-btn ps-btn-xs" onClick={() => setDialog({ kind: "newFolder" })}><FolderPlus size={13} /> New folder</button>
              </div>
            )}
          </section>
        ) : (
          <div className="flex flex-col gap-9">
            {shownFolders.length ? (
              <section aria-labelledby="folders-title">
                <SectionTitle title={<span id="folders-title">Folders</span>} caption={`${shownFolders.length}`} className="mb-4" />
                <ul className={FOLDER_GRID} aria-label="Folders">
                  {shownFolders.map((f) => (
                    <FolderCard
                      key={f.id}
                      folder={f}
                      onOpen={(id) => go(id)}
                      onRename={(folder) => setDialog({ kind: "rename", folder })}
                      onMove={(folder) => setDialog({ kind: "moveFolder", folder })}
                      onDelete={(folder) => setDialog({ kind: "deleteFolder", folder })}
                      onDropItem={dropOn}
                    />
                  ))}
                </ul>
              </section>
            ) : null}

            {myDecks.length ? (
              <section aria-labelledby="my-decks-title">
                <SectionTitle
                  title={<span id="my-decks-title">{explorer ? (currentId ? "Decks in this folder" : "My decks") : "Decks"}</span>}
                  caption={`${myDecks.length}`}
                  className="mb-4"
                />
                {view === "grid" ? (
                  <ul className={GRID} aria-label="Decks">
                    {myDecks.map((d) => (
                      <DeckCard
                        key={d.id}
                        summary={d}
                        actions={actions}
                        dragProps={dragProps(d)}
                        extra={
                          <div className="flex flex-col gap-1">
                            <SharingBadge sharing={d.sharing} teamNames={teamNames} />
                            {!explorer ? <span className="ps-caption truncate">in {where(d)}</span> : null}
                          </div>
                        }
                      />
                    ))}
                  </ul>
                ) : (
                  <>
                    <div className="ps-caption hidden grid-cols-[minmax(0,2.4fr)_minmax(0,1.4fr)_minmax(0,1.2fr)_80px_80px_90px_32px] gap-3 px-3 pb-1 md:grid" aria-hidden>
                      <span>Name</span>
                      <span>Sharing</span>
                      <span>Location</span>
                      <span>Slides</span>
                      <span>Size</span>
                      <span>Modified</span>
                      <span />
                    </div>
                    <ul aria-label="Decks">
                      {myDecks.map((d) => (
                        <DeckListRow key={d.id} summary={d} actions={actions} location={explorer ? undefined : where(d)} badge={<SharingBadge sharing={d.sharing} teamNames={teamNames} />} />
                      ))}
                    </ul>
                  </>
                )}
              </section>
            ) : null}

            {sharedDecks.length ? (
              <section aria-labelledby="shared-decks-title">
                <SectionTitle title={<span id="shared-decks-title">Shared with me</span>} caption={`${sharedDecks.length} from other people and teams`} className="mb-4" />
                {view === "grid" ? (
                  <ul className={GRID} aria-label="Shared decks">
                    {sharedDecks.map((d) => (
                      <SharedDeckCard key={d.id} deck={d} teamNames={teamNames} />
                    ))}
                  </ul>
                ) : (
                  <ul aria-label="Shared decks">
                    {sharedDecks.map((d) => (
                      <li key={d.id} className="flex flex-wrap items-center gap-3 rounded-[var(--ps-r-md)] px-3 py-2 hover:bg-[var(--ps-plate)]">
                        <Link href={`/deck/${encodeURIComponent(d.id)}`} className="min-w-0 flex-1 truncate text-[14px] font-medium text-[var(--ps-ink)]">
                          {title(d)}
                        </Link>
                        <span className="ps-pill">{d.role === "editor" ? "Can edit" : "Can view"}</span>
                        <span className="ps-caption">{d.ownerName}</span>
                        {d.teamIds.length ? <span className="ps-caption">via {d.teamIds.map((id) => teamNames.get(id) ?? "a team").join(", ")}</span> : null}
                        <span className="ps-caption">{timeAgo(d.updatedAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ) : null}
          </div>
        )}

        <p className="ps-caption mt-10">
          Deleted decks wait in the{" "}
          <Link href="/trash" className="ps-link">
            Trash
          </Link>{" "}
          for 30 days, and still count toward your storage until then.
        </p>
      </div>

      <DeleteDeckDialog deck={pendingDelete} onCancel={() => setPendingDelete(null)} onConfirm={confirmDelete} />

      {dialog?.kind === "newFolder" ? (
        <NameDialog
          title="New folder"
          description={currentId ? `It will be created inside ${trail[trail.length - 1]?.name}.` : undefined}
          label="Folder name"
          confirmLabel="Create folder"
          onSubmit={async (name) => {
            await createFolder(name, currentId);
            await refresh();
          }}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === "rename" ? (
        <NameDialog
          title="Rename folder"
          label="Folder name"
          initial={dialog.folder.name}
          confirmLabel="Rename"
          onSubmit={async (name) => {
            await renameFolder(dialog.folder.id, name);
            await refresh();
          }}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === "moveDeck" ? (
        <MoveDialog title={`Move “${title(dialog.deck)}”`} folders={folders} currentFolderId={dialog.deck.folderId ?? null} onMove={(folderId) => moveDeckTo(dialog.deck.id, folderId)} onClose={() => setDialog(null)} />
      ) : null}
      {dialog?.kind === "moveFolder" ? (
        <MoveDialog title={`Move folder “${dialog.folder.name}”`} folders={folders} currentFolderId={dialog.folder.parentId} disabledIds={disabledForMove} onMove={(parentId) => moveFolderTo(dialog.folder.id, parentId)} onClose={() => setDialog(null)} />
      ) : null}
      {dialog?.kind === "share" ? (
        <ShareDialog
          id={dialog.id}
          open
          onOpenChange={(open) => {
            if (open) return;
            setDialog(null);
            void refresh();
          }}
        />
      ) : null}
      {dialog?.kind === "deleteFolder" ? (
        <Dialog open onOpenChange={(open) => !open && setDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete the folder “{dialog.folder.name}”?</DialogTitle>
              <DialogDescription>The decks and folders inside it are not deleted. They move up one level.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <button type="button" className="ps-btn" onClick={() => setDialog(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="ps-btn ps-btn-primary"
                data-danger="true"
                onClick={() => {
                  const id = dialog.folder.id;
                  setDialog(null);
                  deleteFolder(id)
                    .then(async () => {
                      if (currentId === id) go(dialog.folder.parentId);
                      await refresh();
                      toast("Folder deleted. Its contents moved up one level.");
                    })
                    .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not delete the folder."));
                }}
              >
                Delete folder
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </AppShell>
  );
}
