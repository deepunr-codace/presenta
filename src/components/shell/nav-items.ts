import type { ComponentType } from "react";
import { FolderSimple, House, Plus, SquaresFour, Stack, type IconProps } from "@phosphor-icons/react";

export type NavKey = "home" | "decks" | "new" | "projects" | "templates";

export type NavItem = {
  key: NavKey;
  label: string;
  href: string;
  icon: ComponentType<IconProps>;
  /** Shown with a "Soon" tag, `aria-disabled` and not navigable. */
  disabled?: boolean;
};

/** Top nav links (DESIGN.md §4): Studio, Decks, New deck; Projects and Templates marked "Soon". */
export const NAV_ITEMS: NavItem[] = [
  { key: "home", label: "Studio", href: "/", icon: House },
  { key: "decks", label: "Decks", href: "/#decks", icon: SquaresFour },
  { key: "new", label: "New deck", href: "/new", icon: Plus },
  { key: "projects", label: "Projects", href: "#", icon: FolderSimple, disabled: true },
  { key: "templates", label: "Templates", href: "#", icon: Stack, disabled: true },
];
