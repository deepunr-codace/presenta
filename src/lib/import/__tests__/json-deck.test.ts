import { describe, expect, it } from "vitest";
import { DeckSchema } from "@/lib/deck/schema";
import { jsonToDeck } from "../json-deck";

const texts = (deck: ReturnType<typeof jsonToDeck>) => deck.slides.flatMap((s) => s.elements).map((e) => ("html" in e ? e.html : "")).join(" ");

describe("jsonToDeck", () => {
  it("turns a list of records into one editable slide per record", () => {
    const deck = jsonToDeck({ title: "Team", people: [{ name: "Ada", role: "Engineer", city: "London" }, { name: "Linus", role: "Maintainer" }] }, "team.json");
    expect(DeckSchema.safeParse(deck).success).toBe(true);
    expect(deck.slides.length).toBeGreaterThanOrEqual(3);
    expect(texts(deck)).toContain("Ada");
    expect(texts(deck)).toContain("Role: Engineer");
    expect(deck.slides.every((s) => s.elements.every((e) => e.type !== "text" || e.html.length > 0))).toBe(true);
  });

  it("turns a plain object into one slide per field", () => {
    const deck = jsonToDeck({ vision: "Make decks simple", metrics: { users: 1200, growth: "12%" } }, "plan.json");
    expect(DeckSchema.safeParse(deck).success).toBe(true);
    expect(texts(deck)).toContain("Vision");
    expect(texts(deck)).toContain("Users: 1200");
  });

  it("handles a bare array of strings", () => {
    const deck = jsonToDeck(["one", "two", "three"], "list.json");
    expect(DeckSchema.safeParse(deck).success).toBe(true);
    expect(deck.slides.length).toBe(5);
  });
});
