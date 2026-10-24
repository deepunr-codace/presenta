"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { X } from "@phosphor-icons/react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ApiKeyDialog } from "./ApiKeyDialog";
import { CommandPalette } from "./CommandPalette";
import { KeyBanner } from "./KeyBanner";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { Mark } from "./Mark";
import { SideNav, type SideNavProps } from "./SideNav";
import { NavLinks, TopNav } from "./TopNav";
import { TopBar, type Crumb } from "./TopBar";
import type { NavKey } from "./nav-items";

/** Pins the nav sheet to the left edge; inline so it wins over the dialog's centring utilities. */
const SHEET_STYLE: CSSProperties = { top: 0, left: 0, bottom: 0, translate: "none", transform: "none" };

export type AppShellProps = {
  children: ReactNode;
  /** Breadcrumb trail shown as a small smoke line under the nav (work surfaces only). */
  breadcrumbs?: Crumb[];
  /** Page actions on the right of that line. */
  actions?: ReactNode;
  /** Which nav link is highlighted. */
  active?: NavKey;
  /** Show the offline-mode banner under the nav (home only). */
  banner?: boolean;
  /** Left sidebar: `full` adds the workspace panel (home); `rail` is the icon rail only (editor, wizard). */
  sidebar?: SideNavProps["variant"];
  /** Extra classes for the scrolling content column. */
  className?: string;
};

/**
 * App shell (DESIGN.md §4): a 56 px top nav on the canvas over a content column that scrolls on
 * its own (so the nav stays pinned on the editor and review). Under 768 px the nav links collapse
 * into a menu button that opens them in a sheet.
 */
export function AppShell({ children, breadcrumbs, actions, active, banner = false, sidebar = "rail", className }: AppShellProps) {
  const [navOpen, setNavOpen] = useState(false);
  const closeNav = () => setNavOpen(false);

  return (
    <div className="ps-shell" data-sidebar="">
      <TopNav active={active} onMenu={() => setNavOpen(true)} />
      <SideNav active={active} variant={sidebar} />
      <div className={className ? `ps-content ${className}` : "ps-content"}>
        {banner ? <KeyBanner /> : null}
        <TopBar breadcrumbs={breadcrumbs} actions={actions} />
        <div className="ps-content-body">{children}</div>
      </div>

      <ApiKeyDialog />
      <CommandPalette />
      <ShortcutsDialog />

      <Dialog open={navOpen} onOpenChange={setNavOpen}>
        <DialogContent className="ps-navsheet" style={SHEET_STYLE} showCloseButton={false} aria-label="Navigation">
          <div className="mb-4 flex items-center justify-between">
            <span className="ps-wordmark">
              <Mark />
              Presenta
            </span>
            <button type="button" className="ps-iconbtn" aria-label="Close navigation" onClick={closeNav}>
              <X size={16} weight="bold" />
            </button>
          </div>
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          <nav aria-label="Primary">
            <NavLinks active={active} onNavigate={closeNav} />
          </nav>
        </DialogContent>
      </Dialog>
    </div>
  );
}
