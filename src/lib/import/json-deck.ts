import { buildDeck } from "@/lib/deck/layouts";
import { GenerationSchema, type Deck, type Generation, type SlideContent } from "@/lib/deck/schema";

const TITLE_KEYS = ["title", "name", "heading", "headline", "label", "topic", "id"];
const SUB_KEYS = ["subtitle", "description", "summary", "text", "body", "content", "caption"];
const LIST_KEYS = ["slides", "pages", "sections", "items", "entries", "records", "data", "results", "list"];

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isScalar = (v: unknown): v is string | number | boolean => ["string", "number", "boolean"].includes(typeof v);
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const nice = (key: string) => key.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());

function pick(o: Obj, keys: string[]): string | undefined {
  for (const k of keys) {
    const hit = Object.keys(o).find((x) => x.toLowerCase() === k);
    if (hit !== undefined && isScalar(o[hit]) && String(o[hit]).trim()) return String(o[hit]);
  }
  return undefined;
}

/** Short "label: value" lines for the remaining fields of an object, flattening one level of nesting and lists. */
function facts(o: Obj, skip: Set<string>): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(o)) {
    if (skip.has(k)) continue;
    if (isScalar(v)) out.push(`${nice(k)}: ${v}`);
    else if (Array.isArray(v)) {
      if (v.every(isScalar)) out.push(`${nice(k)}: ${v.join(", ")}`);
      else for (const item of v) out.push(isObj(item) ? facts(item, new Set()).slice(0, 2).join(" · ") || nice(k) : String(item));
    } else if (isObj(v)) {
      for (const [k2, v2] of Object.entries(v)) if (isScalar(v2)) out.push(`${nice(k)} ${k2}: ${v2}`);
    }
  }
  return out.filter(Boolean);
}

function slideFor(item: unknown, index: number, key?: string): SlideContent {
  if (!isObj(item)) {
    return { kind: "bullets", title: clip(key ? nice(key) : `Item ${index + 1}`, 90), bullets: [clip(String(item), 110)] };
  }
  const title = pick(item, TITLE_KEYS) ?? key ?? `Item ${index + 1}`;
  const body = pick(item, SUB_KEYS);
  const used = new Set(Object.keys(item).filter((k) => [...TITLE_KEYS, ...SUB_KEYS].includes(k.toLowerCase()) && isScalar(item[k]) && [title, body].includes(String(item[k]))));
  const bullets = facts(item, used).slice(0, 6).map((b) => clip(b, 110));
  return { kind: "bullets", title: clip(nice(title), 90), body: body ? clip(body, 400) : undefined, bullets: bullets.length ? bullets : undefined };
}

/**
 * Turns any JSON document into a normal, fully editable Presenta deck. A deck already in Presenta's own formats is
 * handled elsewhere; this reads everything else: a list of records becomes one slide per record, an object becomes one
 * slide per field, and plain values become bullets.
 */
export function jsonToDeck(value: unknown, fileName: string): Deck {
  const baseTitle = fileName.replace(/\.json$/i, "").replace(/[_-]+/g, " ").trim() || "Imported data";

  const gen = GenerationSchema.safeParse(value);
  if (gen.success) return buildDeck(gen.data, "glass-contrast", { source: "import" });

  let title = baseTitle;
  let items: { value: unknown; key?: string }[] = [];
  if (Array.isArray(value)) items = value.map((v) => ({ value: v }));
  else if (isObj(value)) {
    title = pick(value, ["title", "name", "deck"]) ?? baseTitle;
    const listKey = Object.keys(value).find((k) => LIST_KEYS.includes(k.toLowerCase()) && Array.isArray(value[k]));
    if (listKey) items = (value[listKey] as unknown[]).map((v) => ({ value: v }));
    else {
      items = Object.entries(value)
        .filter(([k, v]) => !(isScalar(v) && TITLE_KEYS.includes(k.toLowerCase())))
        .map(([k, v]) => ({ value: isObj(v) || Array.isArray(v) ? v : { value: v }, key: k }));
    }
  } else items = [{ value: { value } }];

  const slides: SlideContent[] = items.slice(0, 40).map((it, i) => {
    if (Array.isArray(it.value)) {
      const rows = it.value as unknown[];
      return { kind: "bullets", title: clip(nice(it.key ?? `Item ${i + 1}`), 90), bullets: rows.slice(0, 6).map((r) => clip(isObj(r) ? facts(r, new Set()).slice(0, 2).join(" · ") || "—" : String(r), 110)) };
    }
    return slideFor(it.value, i, it.key);
  });

  const content: Generation = {
    title: clip(nice(title), 80),
    slides: [{ kind: "cover", title: clip(nice(title), 90), subtitle: `${slides.length} ${slides.length === 1 ? "item" : "items"} from ${fileName}` }, ...slides, { kind: "closing", title: "Thank you" }],
  };
  return buildDeck(content, "glass-contrast", { source: "import" });
}
