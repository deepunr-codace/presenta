import type { Deck, Slide } from "@/lib/deck/schema";

const DELETED = Symbol("deleted");
type Deleted = typeof DELETED;
type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function equal(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function copy<T>(value: T): T {
  return value === undefined ? value : structuredClone(value);
}

/** Three-way merge: unchanged fields take the other writer's value; same-field conflicts use this save's value. */
function mergeValue(base: unknown, local: unknown, remote: unknown): unknown | Deleted {
  if (equal(local, base)) return copy(remote);
  if (equal(remote, base)) return copy(local);
  if (equal(local, remote)) return copy(local);
  if (local === undefined) return copy(remote);
  if (remote === undefined) return copy(local);
  if (isRecord(base) && isRecord(local) && isRecord(remote)) return mergeRecord(base, local, remote);
  if (!isRecord(base) && isRecord(local) && isRecord(remote)) return mergeRecord({}, local, remote);
  return copy(local);
}

function mergeRecord(base: RecordValue, local: RecordValue, remote: RecordValue): RecordValue {
  const out: RecordValue = {};
  const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)]);
  for (const key of keys) {
    if (key === "elements" && Array.isArray(local[key]) && Array.isArray(remote[key])) {
      const merged = mergeById(
        Array.isArray(base[key]) ? base[key] as RecordValue[] : [],
        local[key] as RecordValue[],
        remote[key] as RecordValue[],
      );
      out[key] = merged;
      continue;
    }
    const value = mergeValue(base[key], local[key], remote[key]);
    if (value !== DELETED && value !== undefined) out[key] = value;
  }
  return out;
}

function mergeById<T extends RecordValue>(base: T[], local: T[], remote: T[]): T[] {
  const b = new Map(base.map((item) => [String(item.id), item]));
  const l = new Map(local.map((item) => [String(item.id), item]));
  const r = new Map(remote.map((item) => [String(item.id), item]));
  const merged = new Map<string, T>();
  for (const id of new Set([...b.keys(), ...l.keys(), ...r.keys()])) {
    const value = mergeValue(b.get(id), l.get(id), r.get(id));
    if (value !== DELETED && value !== undefined) merged.set(id, value as T);
  }

  const baseOrder = base.map((item) => String(item.id)).filter((id) => merged.has(id));
  const localOrder = local.map((item) => String(item.id)).filter((id) => merged.has(id));
  const remoteOrder = remote.map((item) => String(item.id)).filter((id) => merged.has(id));
  const baseSet = new Set(baseOrder);
  const project = (order: string[]) => order.filter((id) => baseSet.has(id));
  const localMoved = !equal(project(localOrder), baseOrder);
  const remoteMoved = !equal(project(remoteOrder), baseOrder);
  const first = localMoved ? localOrder : remoteMoved ? remoteOrder : localOrder;
  const second = first === localOrder ? remoteOrder : localOrder;
  const order = [...first, ...second, ...baseOrder].filter((id, index, all) => merged.has(id) && all.indexOf(id) === index);
  return order.map((id) => merged.get(id) as T);
}

/** Merge decks from a common saved base. Distinct slide/element edits survive concurrent saves. */
export function mergeDecks(base: Deck, local: Deck, remote: Deck): Deck {
  const baseRecord = base as unknown as RecordValue;
  const localRecord = local as unknown as RecordValue;
  const remoteRecord = remote as unknown as RecordValue;
  const merged = mergeRecord(baseRecord, localRecord, remoteRecord);
  const slides = mergeById(base.slides as unknown as RecordValue[], local.slides as unknown as RecordValue[], remote.slides as unknown as RecordValue[]) as unknown as Slide[];
  merged.slides = slides.length ? slides : [structuredClone(local.slides[0] ?? remote.slides[0] ?? base.slides[0])];
  return merged as unknown as Deck;
}
