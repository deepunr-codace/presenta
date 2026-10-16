import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { CaretRight } from "@phosphor-icons/react";

export type Crumb = { label: string; href?: string };

export type TopBarProps = {
  /** Breadcrumb trail, for example Studio / Decks / Deck name. The last item is the current page. */
  breadcrumbs?: Crumb[];
  /** Page actions on the right: a filled pill plus outline secondaries. */
  actions?: ReactNode;
};

/** Work-surface header under the nav: a small smoke breadcrumb line with page actions on the right. Renders nothing when empty. */
export function TopBar({ breadcrumbs = [], actions }: TopBarProps) {
  if (breadcrumbs.length === 0 && !actions) return null;
  const last = breadcrumbs.length - 1;
  return (
    <div className="ps-crumbbar">
      {breadcrumbs.length ? (
        <nav aria-label="Breadcrumb" className="min-w-0">
          <ol className="ps-crumbs">
            {breadcrumbs.map((c, i) => (
              <Fragment key={`${c.label}-${i}`}>
                {i > 0 ? (
                  <li aria-hidden className="ps-crumb-sep">
                    <CaretRight size={11} weight="bold" />
                  </li>
                ) : null}
                <li>{i === last || !c.href ? <span aria-current={i === last ? "page" : undefined}>{c.label}</span> : <Link href={c.href}>{c.label}</Link>}</li>
              </Fragment>
            ))}
          </ol>
        </nav>
      ) : null}
      {actions ? <div className="ps-crumbbar-actions">{actions}</div> : null}
    </div>
  );
}
