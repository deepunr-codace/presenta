import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

type Props = { className?: string; style?: CSSProperties };

/** A grey block with a light sweep across it: the shape of something that is still loading. */
export function Skeleton({ className, style }: Props) {
  return <div className={cn("ps-skeleton", className)} style={style} aria-hidden />;
}

/** A page-shaped placeholder: a heading, a line of text, a toolbar and a grid of cards. */
export function PageSkeleton({ cards = 8 }: { cards?: number }) {
  return (
    <div className="ps-page" role="status" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-3 h-4 w-80 max-w-full" />
      <div className="mt-6 flex flex-wrap gap-3">
        <Skeleton className="h-8 w-24 rounded-full" />
        <Skeleton className="h-8 w-28 rounded-full" />
        <Skeleton className="h-8 w-24 rounded-full" />
        <Skeleton className="ml-auto h-8 w-56" />
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: cards }, (_, i) => (
          <div key={i} className="ps-glass flex flex-col gap-3 p-3" data-paper>
            <Skeleton className="aspect-video w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/**
 * The whole app frame as a placeholder (rail, top bar, page), shown the instant you navigate while the next page
 * loads, so the sidebar never blinks away and the layout does not jump.
 */
export function ShellSkeleton() {
  return (
    <div className="ps-shell" data-sidebar="">
      <aside className="ps-sidenav" data-variant="rail" aria-hidden>
        <div className="ps-rail">
          <Skeleton className="size-9 rounded-xl" />
          <div className="ps-rail-items mt-4 w-full items-center">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 py-1">
                <Skeleton className="h-9 w-12 rounded-xl" />
                <Skeleton className="h-2.5 w-10 rounded-full" />
              </div>
            ))}
          </div>
          <Skeleton className="size-9 rounded-full" />
        </div>
      </aside>
      <div className="ps-content">
        <div className="ps-content-body ps-reveal">
          <PageSkeleton />
        </div>
      </div>
    </div>
  );
}
