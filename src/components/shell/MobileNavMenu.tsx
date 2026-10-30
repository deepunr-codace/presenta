"use client";

import Link from "next/link";
import { ArrowRight, MagnifyingGlass } from "@phosphor-icons/react";
import { NAV_ITEMS, type NavKey } from "./nav-items";
import { useOverlays } from "./overlay-store";

const sections: { title: string; keys: NavKey[] }[] = [
  { title: "Workspace", keys: ["home", "decks", "teams"] },
  { title: "Create", keys: ["new", "templates", "media"] },
  { title: "Insights & tools", keys: ["analytics", "integrations", "brand", "labs"] },
  { title: "More", keys: ["trash", "projects"] },
];

const summaries: Partial<Record<NavKey, string>> = {
  home: "Your studio overview",
  decks: "Build and organize presentations",
  teams: "Work together and chat",
  new: "Start a new presentation",
  templates: "Start from a design",
  media: "Your image and media library",
  analytics: "See how shared decks perform",
  integrations: "Connect the tools you use",
  brand: "Keep every deck on brand",
  labs: "Try new tools and ideas",
  trash: "Restore or remove decks",
  projects: "Coming soon",
};

export function MobileNavMenu({ active, onNavigate }: { active?: NavKey; onNavigate: () => void }) {
  const setSearch = useOverlays((state) => state.setSearch);

  return <div className="ps-mobile-nav-content">
    <button type="button" className="ps-mobile-search" onClick={() => { onNavigate(); setSearch(true); }}>
      <MagnifyingGlass size={17} /><span>Search Presenta</span><kbd>⌘ K</kbd>
    </button>
    <nav className="ps-mobile-nav-groups" aria-label="App menu">
      {sections.map((section) => <section className="ps-mobile-nav-group" key={section.title} aria-label={section.title}>
        <h2>{section.title}</h2>
        <ul>{section.keys.map((key) => {
          const item = NAV_ITEMS.find((entry) => entry.key === key);
          if (!item) return null;
          const Icon = item.icon;
          return <li key={item.key}>
            {item.disabled ? <div className="ps-mobile-nav-item" aria-disabled="true"><span className="ps-mobile-nav-icon"><Icon size={18} /></span><span className="ps-mobile-nav-copy"><strong>{item.label}</strong><small>{summaries[item.key]}</small></span><span className="ps-mobile-nav-soon">Soon</span></div> : <Link href={item.href} className="ps-mobile-nav-item" data-active={active === item.key ? "true" : undefined} aria-current={active === item.key ? "page" : undefined} onClick={onNavigate}><span className="ps-mobile-nav-icon"><Icon size={18} /></span><span className="ps-mobile-nav-copy"><strong>{item.label}</strong><small>{summaries[item.key]}</small></span><ArrowRight size={14} className="ps-mobile-nav-arrow" /></Link>}
          </li>;
        })}</ul>
      </section>)}
    </nav>
  </div>;
}
