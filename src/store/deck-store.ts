import { create } from "zustand";
import { newId } from "@/lib/deck/ids";
import { applyLayout, buildSlide } from "@/lib/deck/layouts";
import { applyOps } from "@/lib/deck/ops";
import type { Deck, Element, LayoutId, PatchOp, Slide, SlideContent, ThemeId } from "@/lib/deck/schema";
import { getTheme } from "@/lib/deck/themes";
import { saveDeck } from "@/lib/persist";

export const HISTORY_CAP = 100;
export const AUTOSAVE_MS = 800;
/** Second commit with the same `coalesce` key inside this window merges into the previous history step. */
export const COALESCE_MS = 500;
/** Wait before the one retry of a failed autosave. */
export const SAVE_RETRY_MS = 1000;

type CommitOptions = {
  /**
   * Key for merging bursts of the same gesture (drag frames, arrow-key nudges)
   * into one undo step: when it equals the previous commit's key and that
   * commit happened less than `COALESCE_MS` ago, the top history entry is
   * replaced instead of a new one being pushed.
   */
  coalesce?: string;
};

/** A mutator may return `false` to say it changed nothing; the commit is then skipped entirely. */
type DeckMutator = (d: Deck) => void | boolean;

const DEFAULT_SLIDE_CONTENT: SlideContent = {
  kind: "bullets",
  title: "New slide",
  bullets: ["First point", "Second point"],
};

export type ElementPatch = Partial<Element>;

type DeckState = {
  deck: Deck | null;
  selectedSlideId: string | null;
  selectedElementIds: string[];
  past: Deck[];
  future: Deck[];
  editingElementId: string | null;
  zoom: "fit" | number;
  dirty: boolean;
  /** Message of the last autosave failure (after its retry), or null once a save succeeds. */
  saveError: string | null;
  /** A save request is on its way. */
  saving: boolean;
};

type DeckActions = {
  loadDeck: (deck: Deck, selectedSlideId?: string | null) => void;
  newBlankDeck: (themeId: ThemeId) => Deck;
  /**
   * Apply `mutator` to a clone of the deck as one undoable step. `label` names
   * the change for the caller; it is not stored. A mutator that changes
   * nothing (or returns `false`) records no history and no save.
   */
  commit: (mutator: DeckMutator, label?: string, options?: CommitOptions) => void;
  undo: () => void;
  redo: () => void;
  selectSlide: (id: string | null) => void;
  selectElements: (ids: string[]) => void;
  updateElement: (slideId: string, elementId: string, patch: ElementPatch) => void;
  addElement: (slideId: string, element: Element) => void;
  deleteElements: (slideId: string, ids: string[]) => void;
  duplicateElements: (slideId: string, ids: string[]) => void;
  reorderSlides: (from: number, to: number) => void;
  addSlide: (afterIndex: number, slide?: Slide) => void;
  duplicateSlide: (id: string) => void;
  deleteSlide: (id: string) => void;
  setTheme: (themeId: ThemeId) => void;
  applyLayoutToSlide: (slideId: string, layoutId: LayoutId) => void;
  setTitle: (title: string) => void;
  applyPatch: (ops: PatchOp[]) => void;
  /* UI-only state; these do not touch the deck and are not undoable. */
  setEditingElement: (id: string | null) => void;
  setZoom: (zoom: "fit" | number) => void;
};

type DeckStore = DeckState & DeckActions;

/* ---------- autosave ---------- */

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingDeck: Deck | null = null;
let inflight: Promise<void> | null = null;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function errorMessage(err: unknown): string {
  return err instanceof Error && err.message ? err.message : "The deck could not be saved. Check your connection.";
}

/**
 * Write the deck, retrying once after `SAVE_RETRY_MS`. Success clears
 * `saveError` (and `dirty` when the saved deck is still the current one);
 * a second failure is surfaced through `saveError` for the UI to show.
 */
async function persistNow(deck: Deck): Promise<void> {
  useDeckStore.setState({ saving: true });
  try {
    await persistAttempts(deck);
  } finally {
    useDeckStore.setState({ saving: false });
  }
}

async function persistAttempts(deck: Deck): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) await wait(SAVE_RETRY_MS);
    try {
      const saved = await saveDeck(deck);
      const current = useDeckStore.getState().deck;
      const stillCurrent = Boolean(current && current.id === deck.id && current.updatedAt === deck.updatedAt);
      if (stillCurrent && JSON.stringify(saved) !== JSON.stringify(deck)) {
        // Adopt server-side merges without resetting the editor's undo/redo stacks.
        useDeckStore.setState((state) => ({ deck: saved, ...reconcileSelection(saved, state) }));
      }
      useDeckStore.setState(stillCurrent ? { dirty: false, saveError: null } : { saveError: null });
      return;
    } catch (err) {
      lastError = err;
    }
  }
  // eslint-disable-next-line no-console -- the UI shows saveError; the console keeps the cause for debugging
  console.error("Autosave failed", lastError);
  useDeckStore.setState({ saveError: errorMessage(lastError) });
}

function scheduleSave(deck: Deck): void {
  pendingDeck = deck;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const d = pendingDeck;
    pendingDeck = null;
    if (d) inflight = queueSave(d);
  }, AUTOSAVE_MS);
}

/** Start a save after the one in flight finishes, so two saves never race (stale base, double uploads). */
function queueSave(deck: Deck): Promise<void> {
  const previous = inflight ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(() => persistNow(deck));
  inflight = next;
  return next;
}

/** Save any pending autosave immediately. Resolves once the write is done. */
export async function flushSave(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  const d = pendingDeck;
  pendingDeck = null;
  if (d) inflight = queueSave(d);
  if (inflight) await inflight;
}

/** The Save button and Ctrl+S: write the current deck now, also to retry after a failed autosave. */
export async function saveNow(): Promise<void> {
  const { deck, dirty, saveError } = useDeckStore.getState();
  if (deck && (dirty || saveError) && !pendingDeck) pendingDeck = deck;
  if (inflight) await inflight;
  await flushSave();
}

/* ---------- helpers ---------- */

const nowIso = () => new Date().toISOString();

function findSlide(deck: Deck, slideId: string): Slide | undefined {
  return deck.slides.find((s) => s.id === slideId);
}

function topZ(slide: Slide): number {
  return slide.elements.reduce((m, e) => Math.max(m, e.z), 0);
}

function cloneElementWithNewId(el: Element, offset = 0): Element {
  const copy = structuredClone(el);
  copy.id = newId(el.type);
  copy.x += offset;
  copy.y += offset;
  return copy;
}

function cloneSlideWithNewIds(slide: Slide): Slide {
  const copy = structuredClone(slide);
  copy.id = newId("slide");
  copy.elements = copy.elements.map((el) => cloneElementWithNewId(el));
  return copy;
}

/**
 * Keep selection consistent with a (possibly changed) deck: drop a selected
 * slide that no longer exists, drop selected elements that are gone, and
 * clear element selection whenever the selected slide changes.
 */
function reconcileSelection(
  deck: Deck,
  state: Pick<DeckState, "selectedSlideId" | "selectedElementIds" | "editingElementId">,
  preferredSlideId?: string | null,
): Pick<DeckState, "selectedSlideId" | "selectedElementIds" | "editingElementId"> {
  const wanted = preferredSlideId !== undefined ? preferredSlideId : state.selectedSlideId;
  const slide = wanted ? findSlide(deck, wanted) : undefined;
  const nextSlideId = slide ? slide.id : (deck.slides[0]?.id ?? null);
  if (nextSlideId !== state.selectedSlideId) {
    return { selectedSlideId: nextSlideId, selectedElementIds: [], editingElementId: null };
  }
  const live = slide ? new Set(slide.elements.map((e) => e.id)) : new Set<string>();
  const selectedElementIds = state.selectedElementIds.filter((id) => live.has(id));
  const editingElementId = state.editingElementId && live.has(state.editingElementId) ? state.editingElementId : null;
  return { selectedSlideId: nextSlideId, selectedElementIds, editingElementId };
}

const initialState: DeckState = {
  deck: null,
  selectedSlideId: null,
  selectedElementIds: [],
  past: [],
  future: [],
  editingElementId: null,
  zoom: "fit",
  dirty: false,
  saveError: null,
  saving: false,
};

/** The previous commit's coalesce key and time; cleared by load, undo and redo. */
let lastCommit: { key: string; at: number } | null = null;

/** Cheap structural equality for two decks that share most of their shape. */
function sameDeck(a: Deck, b: Deck): boolean {
  if (a.title !== b.title || a.themeId !== b.themeId || a.slides.length !== b.slides.length) return false;
  return JSON.stringify(a.slides) === JSON.stringify(b.slides) && JSON.stringify(a.meta) === JSON.stringify(b.meta);
}

/* ---------- store ---------- */

export const useDeckStore = create<DeckStore>()((set, get) => {
  /** Swap the current deck for `next` (undo/redo), keeping selection sane. */
  const swapDeck = (next: Deck, past: Deck[], future: Deck[]) => {
    const s = get();
    lastCommit = null;
    set({ deck: next, past, future, dirty: true, ...reconcileSelection(next, s) });
    scheduleSave(next);
  };

  return {
    ...initialState,

    loadDeck: (deck, preferredSlideId) => {
      lastCommit = null;
      set({
        ...initialState,
        zoom: get().zoom,
        deck,
        selectedSlideId: deck.slides.some((slide) => slide.id === preferredSlideId) ? preferredSlideId! : deck.slides[0]?.id ?? null,
      });
    },

    newBlankDeck: (themeId) => {
      const theme = getTheme(themeId);
      const now = nowIso();
      const deck: Deck = {
        id: newId("deck"),
        title: "Untitled deck",
        themeId,
        slides: [buildSlide(DEFAULT_SLIDE_CONTENT, theme, "title-bullets")],
        createdAt: now,
        updatedAt: now,
        meta: { source: "blank" },
        version: 1,
      };
      get().loadDeck(deck);
      set({ dirty: true });
      scheduleSave(deck);
      return deck;
    },

    commit: (mutator, _label, options) => {
      const s = get();
      if (!s.deck) return;
      const previous = s.deck;
      const next = structuredClone(previous);
      if (mutator(next) === false || sameDeck(previous, next)) return;
      next.updatedAt = nowIso();
      const now = Date.now();
      const key = options?.coalesce;
      const merge = Boolean(key && lastCommit && lastCommit.key === key && now - lastCommit.at < COALESCE_MS && s.past.length > 0);
      // Merging keeps the history top as it is: the entry before the first commit of the burst stays the undo target.
      const past = merge
        ? s.past
        : s.past.length >= HISTORY_CAP
          ? [...s.past.slice(s.past.length - HISTORY_CAP + 1), previous]
          : [...s.past, previous];
      lastCommit = key ? { key, at: now } : null;
      set({ deck: next, past, future: [], dirty: true, ...reconcileSelection(next, s) });
      scheduleSave(next);
    },

    undo: () => {
      const s = get();
      if (!s.deck || s.past.length === 0) return;
      const previous = s.past[s.past.length - 1];
      swapDeck(previous, s.past.slice(0, -1), [s.deck, ...s.future]);
    },

    redo: () => {
      const s = get();
      if (!s.deck || s.future.length === 0) return;
      const [next, ...rest] = s.future;
      swapDeck(next, [...s.past, s.deck], rest);
    },

    selectSlide: (id) => {
      const s = get();
      if (id === s.selectedSlideId) return;
      set({ selectedSlideId: id, selectedElementIds: [], editingElementId: null });
    },

    selectElements: (ids) => {
      const s = get();
      const editing = s.editingElementId && ids.includes(s.editingElementId) ? s.editingElementId : null;
      set({ selectedElementIds: [...ids], editingElementId: editing });
    },

    updateElement: (slideId, elementId, patch) => {
      get().commit((d) => {
        const slide = findSlide(d, slideId);
        const el = slide?.elements.find((e) => e.id === elementId);
        if (!el) return;
        Object.assign(el, patch, { id: el.id, type: el.type });
      }, "Update element");
    },

    addElement: (slideId, element) => {
      const s = get();
      if (!s.deck || !findSlide(s.deck, slideId)) return;
      s.commit((d) => {
        const slide = findSlide(d, slideId);
        if (!slide) return;
        const el = structuredClone(element);
        el.z = Math.max(el.z, topZ(slide) + 1);
        slide.elements.push(el);
      }, "Add element");
      set({ ...reconcileSelection(get().deck as Deck, get(), slideId), selectedElementIds: [element.id] });
    },

    deleteElements: (slideId, ids) => {
      if (ids.length === 0) return;
      const drop = new Set(ids);
      get().commit((d) => {
        const slide = findSlide(d, slideId);
        if (!slide) return;
        slide.elements = slide.elements.filter((e) => !drop.has(e.id));
      }, "Delete elements");
    },

    duplicateElements: (slideId, ids) => {
      if (ids.length === 0) return;
      const wanted = new Set(ids);
      const created: string[] = [];
      get().commit((d) => {
        const slide = findSlide(d, slideId);
        if (!slide) return;
        let z = topZ(slide);
        const copies = slide.elements
          .filter((e) => wanted.has(e.id))
          .map((e) => {
            const copy = cloneElementWithNewId(e, 24);
            copy.z = ++z;
            created.push(copy.id);
            return copy;
          });
        slide.elements.push(...copies);
      }, "Duplicate elements");
      if (created.length && get().deck) {
        set({ ...reconcileSelection(get().deck as Deck, get(), slideId), selectedElementIds: created });
      }
    },

    reorderSlides: (from, to) => {
      const s = get();
      if (!s.deck) return;
      const n = s.deck.slides.length;
      if (from === to || from < 0 || to < 0 || from >= n || to >= n) return;
      s.commit((d) => {
        const [slide] = d.slides.splice(from, 1);
        d.slides.splice(to, 0, slide);
      }, "Reorder slides");
    },

    addSlide: (afterIndex, slide) => {
      const s = get();
      if (!s.deck) return;
      const theme = getTheme(s.deck.themeId);
      const fresh = slide ?? buildSlide(DEFAULT_SLIDE_CONTENT, theme, "title-bullets");
      const at = Math.max(0, Math.min(afterIndex + 1, s.deck.slides.length));
      s.commit((d) => {
        d.slides.splice(at, 0, fresh);
      }, "Add slide");
      set(reconcileSelection(get().deck as Deck, get(), fresh.id));
    },

    duplicateSlide: (id) => {
      const s = get();
      if (!s.deck) return;
      const index = s.deck.slides.findIndex((sl) => sl.id === id);
      if (index < 0) return;
      const copy = cloneSlideWithNewIds(s.deck.slides[index]);
      s.commit((d) => {
        d.slides.splice(index + 1, 0, copy);
      }, "Duplicate slide");
      set(reconcileSelection(get().deck as Deck, get(), copy.id));
    },

    deleteSlide: (id) => {
      const s = get();
      if (!s.deck) return;
      const index = s.deck.slides.findIndex((sl) => sl.id === id);
      if (index < 0 || s.deck.slides.length <= 1) return;
      const neighbour = s.deck.slides[index + 1]?.id ?? s.deck.slides[index - 1]?.id ?? null;
      s.commit((d) => {
        d.slides.splice(index, 1);
      }, "Delete slide");
      if (s.selectedSlideId === id) set(reconcileSelection(get().deck as Deck, get(), neighbour));
    },

    setTheme: (themeId) => {
      get().commit((d) => {
        d.themeId = themeId;
      }, "Change theme");
    },

    applyLayoutToSlide: (slideId, layoutId) => {
      const s = get();
      if (!s.deck) return;
      const theme = getTheme(s.deck.themeId);
      s.commit((d) => {
        const slide = findSlide(d, slideId);
        if (!slide) return;
        slide.layoutId = layoutId;
        if (slide.content) slide.elements = applyLayout(slide.content, layoutId, theme);
      }, "Apply layout");
      if (s.selectedSlideId === slideId) set({ selectedElementIds: [], editingElementId: null });
    },

    setTitle: (title) => {
      get().commit((d) => {
        d.title = title;
      }, "Rename deck");
    },

    applyPatch: (ops) => {
      if (ops.length === 0) return;
      get().commit((d) => {
        const theme = getTheme(d.themeId);
        const patched = applyOps(d, ops, theme);
        d.title = patched.title;
        d.themeId = patched.themeId;
        d.slides = patched.slides;
      }, "AI revision");
    },

    setEditingElement: (id) => set({ editingElementId: id }),
    setZoom: (zoom) => set({ zoom }),
  };
});
