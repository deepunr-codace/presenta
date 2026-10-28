import { vi } from "vitest";
import type { Deck } from "@/lib/deck/schema";

/**
 * An in-memory stand-in for the /api/decks routes, installed as the global `fetch`. It keeps the same rules the
 * real routes enforce (ids must match the URL, saves never change trash state, unknown ids are 404) so the
 * persistence code can be tested without a network or database.
 */
export type FakeServer = {
  decks: Map<string, Deck>;
  trashed: Map<string, string>;
  /** Every request made, as "METHOD /path". */
  calls: string[];
  /** Make the next `count` requests fail with a 500 and this message. */
  failNext: (count: number, message?: string) => void;
  reset: () => void;
};

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

export function installFakeServer(): FakeServer {
  const decks = new Map<string, Deck>();
  const trashed = new Map<string, string>();
  const calls: string[] = [];
  let failures = 0;
  let failureMessage = "Server error.";

  const summary = (d: Deck) => ({ id: d.id, title: d.title, updatedAt: d.updatedAt, slideCount: d.slides.length, themeId: d.themeId });

  const handle = async (input: string, init?: RequestInit): Promise<Response> => {
    const url = new URL(input, "http://localhost");
    const method = (init?.method ?? "GET").toUpperCase();
    calls.push(`${method} ${url.pathname}${url.search}`);
    if (failures > 0) {
      failures -= 1;
      return reply({ error: failureMessage }, 500);
    }

    if (url.pathname === "/api/decks") {
      if (method === "GET") {
        if (url.searchParams.get("ids")) return reply({ ids: [...decks.keys()] });
        const wantTrash = url.searchParams.get("trash") === "1";
        const rows = [...decks.values()]
          .filter((d) => trashed.has(d.id) === wantTrash)
          .map((d) => (wantTrash ? { ...summary(d), trashedAt: trashed.get(d.id) } : summary(d)));
        rows.sort((a, b) => {
          const ka = wantTrash ? ((a as { trashedAt?: string }).trashedAt ?? "") : a.updatedAt;
          const kb = wantTrash ? ((b as { trashedAt?: string }).trashedAt ?? "") : b.updatedAt;
          return kb < ka ? -1 : kb > ka ? 1 : 0;
        });
        return reply({ decks: rows });
      }
      if (method === "DELETE" && url.searchParams.get("trash") === "1") {
        for (const id of trashed.keys()) decks.delete(id);
        trashed.clear();
        return reply({ ok: true });
      }
    }

    const match = /^\/api\/decks\/([^/]+)$/.exec(url.pathname);
    if (match) {
      const id = decodeURIComponent(match[1]);
      if (method === "GET") {
        const deck = decks.get(id);
        return deck ? reply({ deck }) : reply({ error: "That deck was not found." }, 404);
      }
      if (method === "PUT") {
        const deck = JSON.parse(String(init?.body)) as Deck;
        if (deck.id !== id) return reply({ error: "The deck id does not match the URL." }, 400);
        decks.set(id, deck);
        return reply({ ok: true });
      }
      if (method === "PATCH") {
        if (!decks.has(id)) return reply({ error: "That deck was not found." }, 404);
        const { trashed: t } = JSON.parse(String(init?.body)) as { trashed: boolean };
        if (t) trashed.set(id, new Date().toISOString());
        else trashed.delete(id);
        return reply({ ok: true });
      }
      if (method === "DELETE") {
        decks.delete(id);
        trashed.delete(id);
        return reply({ ok: true });
      }
    }
    return reply({ error: "Not found." }, 404);
  };

  vi.stubGlobal("fetch", vi.fn((input: string, init?: RequestInit) => handle(String(input), init)));

  return {
    decks,
    trashed,
    calls,
    failNext: (count, message = "Server error.") => {
      failures = count;
      failureMessage = message;
    },
    reset: () => {
      decks.clear();
      trashed.clear();
      calls.length = 0;
      failures = 0;
    },
  };
}
