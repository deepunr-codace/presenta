"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowUpRight, X } from "@phosphor-icons/react";
import { FitSlide } from "@/components/canvas/FitSlide";
import { resolveTheme } from "@/lib/deck/themes";
import { useDeckStore } from "@/store/deck-store";
import { useMiniDeck, type MiniDeckRect } from "@/store/mini-deck-store";

/** A deck already on screen full size: the corner player stays out of the way. */
const DECK_ROUTE = /^\/(edit|deck|present|print)(\/|$)/;
/** The editing screen, where the deck is watched for leaving. */
const EDITOR_ROUTE = /^\/edit\//;
/** Routes with no app chrome (sign in, sign up, printing), so the card never covers them. */
const HIDDEN_ROUTE = /^\/(edit|deck|present|print|login|signup)(\/|$)/;

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function rectOf(el: Element): MiniDeckRect {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

/**
 * YouTube-style mini player for the editor: leaving `/edit/[id]` for any other page keeps the deck in a
 * small card in the bottom-right corner. Clicking it (or the resume icon) opens the editor again; the X
 * closes it. The card flies out of the canvas it was minimized from.
 */
export function MiniDeck() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const mini = useMiniDeck((s) => s.mini);
  const minimize = useMiniDeck((s) => s.minimize);
  const dismiss = useMiniDeck((s) => s.dismiss);
  const cardRef = useRef<HTMLDivElement>(null);
  const sourceRect = useRef<MiniDeckRect | null>(null);
  const previousPath = useRef(pathname);
  const [closing, setClosing] = useState(false);

  // While editing, remember where the canvas is if the click leads to another page, so the card can fly out of it.
  useEffect(() => {
    if (!EDITOR_ROUTE.test(pathname)) return;
    const onClick = (event: MouseEvent) => {
      const link = (event.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || DECK_ROUTE.test(url.pathname)) return;
      const stage = document.querySelector(".ps-stage-panel");
      sourceRect.current = stage ? rectOf(stage) : null;
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname]);

  // Carry the edited deck out of the editor; drop it again as soon as a deck page opens.
  useEffect(() => {
    const previous = previousPath.current;
    previousPath.current = pathname;
    if (DECK_ROUTE.test(pathname)) {
      if (useMiniDeck.getState().mini) dismiss();
      return;
    }
    if (!EDITOR_ROUTE.test(previous)) return;
    const leavingId = decodeURIComponent(previous.replace(EDITOR_ROUTE, "").split(/[/?#]/)[0]);
    const { deck, selectedSlideId } = useDeckStore.getState();
    if (deck && deck.id === leavingId) minimize(deck, selectedSlideId, sourceRect.current);
    sourceRect.current = null;
  }, [pathname, dismiss, minimize]);

  const visible = Boolean(mini) && !HIDDEN_ROUTE.test(pathname);

  // FLIP: start at the canvas rect and settle into the corner (or pop up softly when the source is unknown).
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!visible || !mini || !el || reducedMotion()) return;
    const to = el.getBoundingClientRect();
    const from = mini.from;
    const frames: Keyframe[] =
      from && to.width > 0
        ? [
            {
              transform: `translate(${from.left + from.width / 2 - (to.left + to.width / 2)}px, ${from.top + from.height / 2 - (to.top + to.height / 2)}px) scale(${from.width / to.width})`,
              opacity: 0.45,
            },
            { transform: "translate(0px, 0px) scale(1)", opacity: 1 },
          ]
        : [
            { transform: "translate(10px, 18px) scale(0.94)", opacity: 0 },
            { transform: "translate(0px, 0px) scale(1)", opacity: 1 },
          ];
    const animation = el.animate(frames, { duration: from ? 520 : 300, easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
    return () => animation.cancel();
  }, [visible, mini]);

  const resume = useCallback(() => {
    if (!mini) return;
    router.push(`/edit/${encodeURIComponent(mini.deck.id)}`);
  }, [mini, router]);

  const close = useCallback(() => {
    const el = cardRef.current;
    if (!el || reducedMotion()) {
      dismiss();
      return;
    }
    setClosing(true);
    const animation = el.animate(
      [
        { transform: "translate(0px, 0px) scale(1)", opacity: 1 },
        { transform: "translate(8px, 14px) scale(0.92)", opacity: 0 },
      ],
      { duration: 200, easing: "ease-in", fill: "forwards" },
    );
    animation.onfinish = () => {
      setClosing(false);
      dismiss();
    };
  }, [dismiss]);

  if (!mini || !visible) return null;
  const { deck } = mini;
  const slide = deck.slides.find((s) => s.id === mini.slideId) ?? deck.slides[0];
  const title = deck.title || "Untitled deck";

  return (
    <aside ref={cardRef} className="ps-mini" data-closing={closing ? "" : undefined} aria-label={`Minimized deck: ${title}`}>
      <button type="button" className="ps-mini-open" onClick={resume} aria-label={`Resume editing ${title}`} title="Resume editing">
        <FitSlide slide={slide} theme={resolveTheme(deck)} className="ps-mini-slide" />
        <span className="ps-mini-veil" aria-hidden />
        <span className="ps-mini-resume" aria-hidden>
          <span>
            <ArrowUpRight size={20} weight="bold" />
          </span>
        </span>
      </button>
      <button type="button" className="ps-mini-close" onClick={close} aria-label="Close minimized deck" title="Close">
        <X size={14} weight="bold" />
      </button>
      <div className="ps-mini-bar">
        <span className="ps-mini-title" title={title}>
          {title}
        </span>
        <span className="ps-mini-hint">Editing</span>
      </div>
    </aside>
  );
}
