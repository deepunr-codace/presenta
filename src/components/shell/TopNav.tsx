"use client";

import Link from "next/link";
import { List } from "@phosphor-icons/react";
import { Avatar } from "./Avatar";
import { Mark } from "./Mark";
import { ModeToggle } from "./ModeToggle";
import { NAV_ITEMS, type NavItem, type NavKey } from "./nav-items";

type NavLinkProps = {
  item: NavItem;
  active: boolean;
  /** Called after a link is activated (closes the mobile sheet). */
  onNavigate?: () => void;
};

/** One nav link: a ghost pill; active is ink-soft; disabled items carry a "Soon" tag and `aria-disabled`. */
function NavLink({ item, active, onNavigate }: NavLinkProps) {
  if (item.disabled) {
    return (
      <button type="button" className="ps-topnav-link" aria-disabled="true" onClick={(e) => e.preventDefault()}>
        {item.label}
        <span className="ps-pill" data-tone="soon">
          Soon
        </span>
      </button>
    );
  }
  return (
    <Link href={item.href} className="ps-topnav-link" data-active={active ? "true" : undefined} aria-current={active ? "page" : undefined} onClick={onNavigate}>
      {item.label}
    </Link>
  );
}

export type NavLinksProps = { active?: NavKey; onNavigate?: () => void };

/** The nav links as a group; used in the top nav and in the mobile sheet. */
export function NavLinks({ active, onNavigate }: NavLinksProps) {
  return (
    <div className="ps-topnav-links">
      {NAV_ITEMS.map((item) => (
        <NavLink key={item.key} item={item} active={item.key === active} onNavigate={onNavigate} />
      ))}
    </div>
  );
}

export type TopNavProps = {
  active?: NavKey;
  /** Opens the navigation sheet; the button only shows under 768 px. */
  onMenu?: () => void;
};

/** 56 px top nav (DESIGN.md §4): wordmark, links with "Soon" tags, mode toggle and avatar; hairline below. */
export function TopNav({ active, onMenu }: TopNavProps) {
  return (
    <header className="ps-topnav">
      {onMenu ? (
        <button type="button" className="ps-iconbtn ps-topnav-menu -ml-2" aria-label="Open navigation" onClick={onMenu}>
          <List size={18} weight="bold" />
        </button>
      ) : null}
      <Link href="/" className="ps-wordmark ps-focus" aria-label="Presenta Studio home">
        <Mark />
        Presenta
      </Link>
      <nav aria-label="Primary" className="min-w-0">
        <NavLinks active={active} />
      </nav>
      <div className="ps-topnav-right">
        <ModeToggle />
        <Avatar />
      </div>
    </header>
  );
}
