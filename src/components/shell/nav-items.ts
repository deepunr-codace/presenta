import type { ComponentType } from "react";
import { Flask, FolderSimple, House, Images, Palette, Plus, SquaresFour, Stack, Trash, type IconProps } from "@phosphor-icons/react";

export type NavKey = "home" | "decks" | "new" | "projects" | "templates" | "media" | "brand" | "labs" | "trash";

export type NavItem = {
  key: NavKey;
  label: string;
  href: string;
  icon: ComponentType<IconProps>;
  /** Shown with a "Soon" tag, `aria-disabled` and not navigable. */
  disabled?: boolean;
};

/** Top nav links (also the mobile menu): Studio, Decks, New deck, Templates, Brand, Trash; Projects marked "Soon". */
export const NAV_ITEMS: NavItem[] = [
  { key: "home", label: "Studio", href: "/", icon: House },
  { key: "decks", label: "Decks", href: "/#decks", icon: SquaresFour },
  { key: "new", label: "New deck", href: "/new", icon: Plus },
  { key: "templates", label: "Templates", href: "/templates", icon: Stack },
  { key: "media", label: "Media", href: "/media", icon: Images },
  { key: "brand", label: "Brand", href: "/brand", icon: Palette },
  { key: "labs", label: "Labs", href: "/labs", icon: Flask },
  { key: "trash", label: "Trash", href: "/trash", icon: Trash },
  { key: "projects", label: "Projects", href: "#", icon: FolderSimple, disabled: true },
];
