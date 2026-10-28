"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/** Give up showing progress after this long, in case a click never leads to a new page. */
const MAX_MS = 12_000;

/**
 * A thin gradient bar across the top that starts the moment you click a link and finishes when the new page arrives.
 * It is the "something is happening" signal for the gap between a click and the next screen.
 */
export function NavProgress() {
  const key = `${usePathname()}?${useSearchParams().toString()}`;
  // The page the bar was started from. It is "running" only while the URL is still that one; the moment the URL
  // changes it stops by itself, with no effect needed to switch it off.
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const running = startedAt === key;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Same page (or only a #hash change): nothing will load.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setStartedAt(key);
      clearTimeout(timer);
      timer = setTimeout(() => setStartedAt(null), MAX_MS);
    };
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      clearTimeout(timer);
    };
  }, [key]);

  return <div className="ps-navbar" data-active={running ? "true" : undefined} role="progressbar" aria-hidden={!running} aria-label="Loading the next page" />;
}
