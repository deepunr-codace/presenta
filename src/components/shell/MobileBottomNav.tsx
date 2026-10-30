"use client";

import Link from "next/link";
import { DotsThree, Plus } from "@phosphor-icons/react";
import { NAV_ITEMS, type NavKey } from "./nav-items";

const PRIMARY_KEYS: NavKey[] = ["home", "decks", "new", "teams"];

/** Compact app-style navigation, shown only on phones. */
export function MobileBottomNav({ active, onMore }: { active?: NavKey; onMore: () => void }) {
  return (
    <nav className="ps-mobile-bottomnav" aria-label="Main navigation">
      {PRIMARY_KEYS.map((key) => {
        const item = NAV_ITEMS.find((entry) => entry.key === key)!;
        const Icon = key === "new" ? Plus : item.icon;
        const selected = active === key;
        return (
          <Link
            key={key}
            href={item.href}
            className="ps-mobile-bottomnav-item"
            data-key={key}
            data-active={selected ? "true" : undefined}
            aria-current={selected ? "page" : undefined}
            aria-label={item.label}
          >
            <span className="ps-mobile-bottomnav-icon"><Icon size={21} weight={selected ? "fill" : "regular"} /></span>
            <span>{key === "home" ? "Studio" : key === "new" ? "Create" : item.label}</span>
          </Link>
        );
      })}
      <button type="button" className="ps-mobile-bottomnav-item" data-key="more" onClick={onMore} aria-label="More">
        <span className="ps-mobile-bottomnav-icon"><DotsThree size={22} weight="bold" /></span>
        <span>More</span>
      </button>
    </nav>
  );
}
