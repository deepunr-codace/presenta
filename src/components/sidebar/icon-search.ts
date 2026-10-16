import * as Phosphor from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

const ICONS = Phosphor as unknown as Record<string, unknown>;

function isIcon(v: unknown): v is Icon {
  return typeof v === "object" && v !== null && "$$typeof" in v && "render" in v;
}

let cachedNames: string[] | null = null;

/** Every Phosphor icon by its bare name ("Rocket"), computed once on first use. */
function allIconNames(): string[] {
  if (cachedNames) return cachedNames;
  const names: string[] = [];
  for (const key of Object.keys(ICONS)) {
    if (!key.endsWith("Icon") || key === "Icon") continue;
    if (!isIcon(ICONS[key])) continue;
    names.push(key.slice(0, -4));
  }
  names.sort();
  cachedNames = names;
  return names;
}

const POPULAR = ["Rocket", "Lightning", "ChartBar", "Users", "Target", "ShieldCheck", "Globe", "Gear", "Clock", "Star", "Heart", "Lightbulb", "Handshake", "Package", "Truck", "Coins", "TrendUp", "Cube", "Sparkle", "Check", "Flag", "Compass", "Database", "Cloud", "Lock", "Megaphone", "Trophy", "Leaf"];

/** Case-insensitive substring search over icon names; an empty query lists popular icons. */
export function searchIcons(query: string, limit = 84): string[] {
  const q = query.trim().toLowerCase().replace(/[-_\s]+/g, "");
  if (!q) return POPULAR;
  const names = allIconNames();
  const starts: string[] = [];
  const contains: string[] = [];
  for (const n of names) {
    const l = n.toLowerCase();
    if (l.startsWith(q)) starts.push(n);
    else if (l.includes(q)) contains.push(n);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}
