import { describe, expect, it } from "vitest";
import {
  BriefStageSchema,
  GenerateRequestSchema,
  GenerationSchema,
  OutlineRequestSchema,
  OutlineSchema,
  RevisionSchema,
  SuggestRequestSchema,
  SuggestResponseSchema,
  type Deck,
  type GenerateRequest,
  type Outline,
  type OutlineRequest,
  type PatchOp,
  type ReviseSelection,
  type Slide,
  type SlideContent,
  type SuggestRequest,
  type TextElement,
} from "@/lib/deck/schema";
import { TYPE_SCALE } from "@/lib/deck/layouts";
import { clip, COLOR_NAMES, FONT_STEP, mockGenerate, mockOutline, mockRevise, mockSuggest } from "../mock";

function suggestReq(partial: Partial<SuggestRequest> & Pick<SuggestRequest, "stage">): SuggestRequest {
  return SuggestRequestSchema.parse({ question: `Question for ${partial.stage}`, ...partial });
}

function outlineReq(partial: Partial<OutlineRequest> & Pick<OutlineRequest, "mode">): OutlineRequest {
  return OutlineRequestSchema.parse(partial);
}

function genReq(partial: Partial<GenerateRequest> & Pick<GenerateRequest, "mode" | "input">): GenerateRequest {
  return GenerateRequestSchema.parse(partial);
}

function slideFrom(content: SlideContent, id: string): Slide {
  return { id, layoutId: "title-bullets", background: { kind: "theme", variant: "default" }, elements: [], notes: "", content };
}

function makeDeck(): Deck {
  const slides: Slide[] = [
    slideFrom({ kind: "cover", title: "Quarterly review", subtitle: "Q3 results", imageQuery: "office skyline" }, "s1"),
    slideFrom(
      {
        kind: "bullets",
        title: "Highlights of the quarter",
        body: "Revenue grew strongly. Churn dropped. Hiring caught up with the plan.",
        bullets: [
          "Revenue grew 24% year over year on the back of enterprise deals",
          "Net churn fell to 1.1% after the onboarding redesign",
          "Hiring reached 94% of plan with 12 engineers joining",
          "Two new regions opened in Q3 with local partners",
          "Support response times improved by a third",
        ],
      },
      "s2",
    ),
    slideFrom({ kind: "stats", title: "By the numbers", stats: [{ value: "24%", label: "Revenue growth" }, { value: "1.1%", label: "Net churn" }] }, "s3"),
    slideFrom({ kind: "closing", title: "Thank you", subtitle: "Questions?", imageQuery: "sunrise" }, "s4"),
  ];
  return {
    id: "deck-1",
    title: "Quarterly review",
    themeId: "glass-contrast",
    slides,
    createdAt: "2026-09-15T00:00:00.000Z",
    updatedAt: "2026-09-15T00:00:00.000Z",
    meta: {},
    version: 1,
  };
}

const PASTE = `# Launch plan for Atlas

Atlas is our new analytics product for mid-market retailers.

## Why now
- Retail margins are under pressure
- Legacy BI tools take weeks to set up
- Buyers want answers, not dashboards

## Results from the pilot
- 38% faster weekly reporting
- $120k saved per store per year
- 3x more managers using data daily

## Rollout steps
1. Step one: onboard the five pilot stores
2. Step two: train regional managers
3. Step three: switch off the legacy reports

## Atlas vs the old stack
Old stack:
- Manual exports every Monday
- One analyst per region
Atlas:
- Live numbers in the morning briefing
- Self-serve for every store manager

## What customers say
"Atlas gave our managers back their Mondays."
— Priya Shah, Head of Operations
`;

describe("clip", () => {
  it("returns short text unchanged and truncates long text at a word boundary", () => {
    expect(clip("hello world", 20)).toBe("hello world");
    const long = clip("The quick brown fox jumps over the lazy dog again and again", 30);
    expect(long.length).toBeLessThanOrEqual(30);
    expect(long.endsWith("…")).toBe(true);
    expect(long).toBe("The quick brown fox jumps…");
  });
});

describe("mockGenerate: paste mode", () => {
  const gen = mockGenerate(genReq({ mode: "paste", input: PASTE, slideCount: 10 }));

  it("produces a valid Generation with cover first and closing last", () => {
    expect(GenerationSchema.safeParse(gen).success).toBe(true);
    expect(gen.slides[0].kind).toBe("cover");
    expect(gen.slides[gen.slides.length - 1].kind).toBe("closing");
    expect(gen.slides.length).toBeLessThanOrEqual(10);
    expect(gen.slides.length).toBeGreaterThanOrEqual(3);
  });

  it("uses the H1 as the deck title and its paragraph as the cover subtitle", () => {
    expect(gen.title).toBe("Launch plan for Atlas");
    expect(gen.slides[0].title).toBe("Launch plan for Atlas");
    expect(gen.slides[0].subtitle).toContain("analytics product");
    expect(gen.slides[0].imageQuery).toBeTruthy();
  });

  it("splits sections on markdown headings and picks kinds by shape", () => {
    const byTitle = new Map(gen.slides.map((s) => [s.title, s]));
    const why = byTitle.get("Why now");
    expect(why?.kind).toBe("bullets");
    expect(why?.bullets).toEqual(["Retail margins are under pressure", "Legacy BI tools take weeks to set up", "Buyers want answers, not dashboards"]);

    const results = byTitle.get("Results from the pilot");
    expect(results?.kind).toBe("stats");
    expect(results?.stats?.map((s) => s.value)).toEqual(["38%", "$120k", "3x"]);
    expect(results?.stats?.[0].label).toBe("faster weekly reporting");

    const steps = byTitle.get("Rollout steps");
    expect(steps?.kind).toBe("process");
    expect(steps?.steps).toHaveLength(3);
    expect(steps?.steps?.[0]).toEqual({ title: "Step one", body: "onboard the five pilot stores" });

    const cmp = byTitle.get("Atlas vs the old stack");
    expect(cmp?.kind).toBe("comparison");
    expect(cmp?.columnTitles).toEqual(["Old stack", "Atlas"]);
    expect(cmp?.bullets).toHaveLength(2);
    expect(cmp?.bulletsRight).toHaveLength(2);

    const quote = byTitle.get("What customers say");
    expect(quote?.kind).toBe("quote");
    expect(quote?.quote).toEqual({ text: "Atlas gave our managers back their Mondays.", by: "Priya Shah, Head of Operations" });
  });

  it("splits blank-line paragraphs and bullet groups when there are no headings", () => {
    const input = `Onboarding today is slow. New hires wait nine days for laptops and access, and managers repeat the same walkthroughs.

Proposed fixes
- Ship equipment before day one
- Automate account provisioning
- Record the core walkthroughs once
- Assign a buddy for the first two weeks

Success metrics
- Time to first commit under 2 days
- 90% of new hires rate onboarding 4/5 or better`;
    const out = mockGenerate(genReq({ mode: "paste", input, slideCount: 6 }));
    expect(GenerationSchema.safeParse(out).success).toBe(true);
    const titles = out.slides.map((s) => s.title);
    expect(titles).toContain("Proposed fixes");
    expect(titles).toContain("Success metrics");
    const fixes = out.slides.find((s) => s.title === "Proposed fixes");
    expect(fixes?.kind).toBe("bullets");
    expect(fixes?.bullets).toHaveLength(4);
    const metrics = out.slides.find((s) => s.title === "Success metrics");
    expect(metrics?.kind).toBe("stats");
    expect(out.slides[0].kind).toBe("cover");
    expect(out.slides.at(-1)?.kind).toBe("closing");
  });

  it("respects the slideCount cap when the source has more sections", () => {
    const many = Array.from({ length: 15 }, (_, i) => `## Topic ${i + 1}\n- Point A about topic ${i + 1}\n- Point B about topic ${i + 1}\n- Point C about topic ${i + 1}`).join("\n\n");
    const out = mockGenerate(genReq({ mode: "paste", input: many, slideCount: 8 }));
    expect(out.slides).toHaveLength(8);
    expect(out.slides[0].kind).toBe("cover");
    expect(out.slides[7].kind).toBe("closing");
  });

  it("truncates overlong lines cleanly to the schema limits", () => {
    const longLine = "This bullet keeps going and going with far more words than any slide could ever reasonably hold on a single line of text without wrapping badly";
    const input = `## Long section\n- ${longLine}\n- ${longLine} again\n- ${longLine} once more\n- short`;
    const out = mockGenerate(genReq({ mode: "paste", input, slideCount: 4 }));
    expect(GenerationSchema.safeParse(out).success).toBe(true);
    const slide = out.slides[1];
    for (const b of slide.bullets ?? []) {
      expect(b.length).toBeLessThanOrEqual(110);
      expect(b).not.toMatch(/\s…$/);
    }
  });

  it("handles a single paragraph without crashing and still returns at least three slides", () => {
    const out = mockGenerate(genReq({ mode: "paste", input: "Just one line of notes about the roadmap.", slideCount: 5 }));
    expect(GenerationSchema.safeParse(out).success).toBe(true);
    expect(out.slides.length).toBeGreaterThanOrEqual(3);
  });

  it("is deterministic", () => {
    const a = mockGenerate(genReq({ mode: "paste", input: PASTE, slideCount: 10 }));
    const b = mockGenerate(genReq({ mode: "paste", input: PASTE, slideCount: 10 }));
    expect(a).toEqual(b);
  });
});

describe("mockGenerate: chat mode", () => {
  const prompt = "Create a 10-slide pitch deck about our AI-powered expense tracking app for small businesses, covering the problem, our solution, market size, and the team.";

  it.each([3, 5, 10, 20])("returns exactly slideCount=%i valid slides with cover first and closing last", (slideCount) => {
    const out = mockGenerate(genReq({ mode: "chat", input: prompt, slideCount }));
    const parsed = GenerationSchema.safeParse(out);
    expect(parsed.success, JSON.stringify(parsed.success ? null : parsed.error.issues)).toBe(true);
    expect(out.slides).toHaveLength(slideCount);
    expect(out.slides[0].kind).toBe("cover");
    expect(out.slides[slideCount - 1].kind).toBe("closing");
    for (const s of out.slides.slice(1, -1)) expect(["cover", "closing"]).not.toContain(s.kind);
  });

  it("derives the title from the prompt and reuses its phrases", () => {
    const out = mockGenerate(genReq({ mode: "chat", input: prompt, slideCount: 10 }));
    expect(out.title).toBe("AI-powered expense tracking app for small businesses");
    const text = JSON.stringify(out).toLowerCase();
    expect(text).toContain("market size");
    expect(text).toContain("solution");
    expect(text).not.toMatch(/lorem|ipsum|tbd|placeholder/);
  });

  it("cycles through varied kinds and puts imageQuery on cover, image-text and closing slides", () => {
    const out = mockGenerate(genReq({ mode: "chat", input: prompt, slideCount: 10 }));
    const kinds = new Set(out.slides.map((s) => s.kind));
    expect(kinds.size).toBeGreaterThanOrEqual(6);
    for (const s of out.slides) {
      if (["cover", "image-text", "closing"].includes(s.kind)) expect(s.imageQuery).toBeTruthy();
    }
  });

  it("is deterministic", () => {
    const req = genReq({ mode: "chat", input: prompt, slideCount: 7, audience: "investors" });
    expect(mockGenerate(req)).toEqual(mockGenerate(req));
  });
});

describe("mockRevise", () => {
  const deck = makeDeck();
  const valid = (r: ReturnType<typeof mockRevise>) => {
    const parsed = RevisionSchema.safeParse(r);
    expect(parsed.success, JSON.stringify(parsed.success ? null : parsed.error.issues)).toBe(true);
    expect(r.summary.length).toBeLessThan(200);
  };

  it("shorter: trims bullets and body of the selected slide", () => {
    const r = mockRevise({ deck, selectedSlideIndex: 1, instruction: "Make this shorter" });
    valid(r);
    expect(r.ops).toHaveLength(1);
    const op = r.ops[0];
    expect(op.op).toBe("replaceSlideContent");
    if (op.op !== "replaceSlideContent") throw new Error("unexpected op");
    expect(op.slideIndex).toBe(1);
    expect(op.content.bullets).toHaveLength(3);
    for (const b of op.content.bullets ?? []) expect(b.length).toBeLessThanOrEqual(60);
    expect(op.content.body).toBe("Revenue grew strongly.");
    expect(op.content.title).toBe("Highlights of the quarter");
  });

  it("shorter without a selection touches every slide", () => {
    const r = mockRevise({ deck, instruction: "shorter please" });
    valid(r);
    expect(r.ops.map((o) => (o.op === "replaceSlideContent" ? o.slideIndex : -1))).toEqual([0, 1, 2, 3]);
  });

  it("longer / expand: adds a bullet to the selected slide", () => {
    const r = mockRevise({ deck, selectedSlideIndex: 1, instruction: "Expand this a bit" });
    valid(r);
    const op = r.ops[0];
    if (op.op !== "replaceSlideContent") throw new Error("unexpected op");
    expect(op.content.bullets).toHaveLength(6);
    expect(op.content.bullets?.[5]).toMatch(/Highlights of the quarter/);
  });

  it("add a slide about X: inserts a bullets slide after the selected slide", () => {
    const r = mockRevise({ deck, selectedSlideIndex: 1, instruction: "Add a slide about pricing tiers" });
    valid(r);
    const op = r.ops[0];
    expect(op.op).toBe("insertSlide");
    if (op.op !== "insertSlide") throw new Error("unexpected op");
    expect(op.atIndex).toBe(2);
    expect(op.content.kind).toBe("bullets");
    expect(op.content.title).toBe("Pricing Tiers");
    expect(op.content.bullets?.length).toBeGreaterThanOrEqual(3);
    expect(JSON.stringify(op.content)).toContain("pricing tiers");
  });

  it("add a slide about X without a selection inserts before the closing slide", () => {
    const r = mockRevise({ deck, instruction: "add slide on competitor landscape" });
    valid(r);
    const op = r.ops[0];
    if (op.op !== "insertSlide") throw new Error("unexpected op");
    expect(op.atIndex).toBe(3);
  });

  it("remove / delete this slide: deletes the selected slide or a numbered one", () => {
    const r = mockRevise({ deck, selectedSlideIndex: 2, instruction: "Delete this slide" });
    valid(r);
    expect(r.ops).toEqual<PatchOp[]>([{ op: "deleteSlide", slideIndex: 2 }]);

    const byNumber = mockRevise({ deck, instruction: "remove slide 2" });
    valid(byNumber);
    expect(byNumber.ops).toEqual<PatchOp[]>([{ op: "deleteSlide", slideIndex: 1 }]);

    const none = mockRevise({ deck, instruction: "remove the slide" });
    valid(none);
    expect(none.ops).toEqual([]);
  });

  it("theme <name>: matches ids and display names", () => {
    const byName = mockRevise({ deck, instruction: "Change the theme to Cobalt Stripes" });
    valid(byName);
    expect(byName.ops).toEqual<PatchOp[]>([{ op: "setTheme", themeId: "cobalt-stripes" }]);

    const byId = mockRevise({ deck, instruction: "theme sky-facet" });
    valid(byId);
    expect(byId.ops).toEqual<PatchOp[]>([{ op: "setTheme", themeId: "sky-facet" }]);

    const unknown = mockRevise({ deck, instruction: "switch the theme to neon" });
    valid(unknown);
    expect(unknown.ops).toEqual([]);
    expect(unknown.summary).toContain("I could not map that request in offline mode.");
  });

  it("title: <x> renames the deck", () => {
    const r = mockRevise({ deck, instruction: "title: Q3 Business Review" });
    valid(r);
    expect(r.ops).toEqual<PatchOp[]>([{ op: "setTitle", title: "Q3 Business Review" }]);
  });

  it("returns a no-op revision with the offline message for unknown requests", () => {
    const r = mockRevise({ deck, selectedSlideIndex: 1, instruction: "Translate everything into Spanish" });
    valid(r);
    expect(r.ops).toEqual([]);
    expect(r.summary).toBe("I could not map that request in offline mode.");
  });

  it("derives content from text elements when a slide has no content", () => {
    const bare: Slide = {
      id: "bare",
      layoutId: "title-bullets",
      background: { kind: "theme", variant: "default" },
      notes: "",
      elements: [
        { id: "t", type: "text", role: "title", html: "<p>Roadmap</p>", x: 0, y: 0, w: 100, h: 50, rotation: 0, z: 1, locked: false, opacity: 1, align: "left", valign: "top", autoFit: true, style: {} },
        { id: "b", type: "text", role: "bullets", html: "<ul><li>Ship v1</li><li>Collect feedback</li><li>Iterate</li><li>Scale</li></ul>", x: 0, y: 60, w: 100, h: 50, rotation: 0, z: 2, locked: false, opacity: 1, align: "left", valign: "top", autoFit: true, style: {} },
      ],
    };
    const d: Deck = { ...deck, slides: [deck.slides[0], bare, deck.slides[3]] };
    const r = mockRevise({ deck: d, selectedSlideIndex: 1, instruction: "make it shorter" });
    valid(r);
    const op = r.ops[0];
    if (op.op !== "replaceSlideContent") throw new Error("unexpected op");
    expect(op.content.title).toBe("Roadmap");
    expect(op.content.kind).toBe("bullets");
    expect(op.content.bullets).toEqual(["Ship v1", "Collect feedback", "Iterate"]);
  });
});

describe("mockSuggest", () => {
  const brief = { topic: "Atlas analytics launch for mid-market retailers", audience: "Investors", goal: "Raise a Series A", mustInclude: ["Pricing model"] };

  it.each(BriefStageSchema.options)("stage %s returns 3 to 6 unique suggestions that validate", (stage) => {
    const out = mockSuggest(suggestReq({ stage, brief }));
    const parsed = SuggestResponseSchema.safeParse(out);
    expect(parsed.success, JSON.stringify(parsed.success ? null : parsed.error.issues)).toBe(true);
    expect(out.suggestions.length).toBeGreaterThanOrEqual(3);
    expect(out.suggestions.length).toBeLessThanOrEqual(6);
    expect(new Set(out.suggestions.map((s) => s.toLowerCase())).size).toBe(out.suggestions.length);
    expect(out.hint).toBeTruthy();
  });

  it.each(BriefStageSchema.options)("stage %s works with an empty brief and no history", (stage) => {
    const out = mockSuggest(suggestReq({ stage }));
    expect(SuggestResponseSchema.safeParse(out).success).toBe(true);
    expect(out.suggestions.length).toBeGreaterThanOrEqual(3);
  });

  it("grounds topic options in the known topic and derives it from history when the brief is empty", () => {
    const withBrief = mockSuggest(suggestReq({ stage: "topic", brief: { topic: "Atlas analytics launch" } }));
    expect(withBrief.suggestions[0]).toBe("Investor pitch for Atlas analytics launch");
    expect(withBrief.suggestions.every((s) => s.toLowerCase().includes("atlas"))).toBe(true);

    const fromHistory = mockSuggest(suggestReq({ stage: "topic", history: [{ role: "user", content: "Create a pitch deck about our expense tracking app" }] }));
    expect(fromHistory.suggestions.some((s) => s.toLowerCase().includes("expense tracking app"))).toBe(true);

    const generic = mockSuggest(suggestReq({ stage: "topic" }));
    expect(generic.suggestions).toContain("Product launch");
    expect(generic.suggestions).toContain("Quarterly business review");
  });

  it("leads the audience list with the audience implied by the topic", () => {
    expect(mockSuggest(suggestReq({ stage: "audience", brief: { topic: "Investor pitch for Atlas" } })).suggestions[0]).toBe("Investors");
    expect(mockSuggest(suggestReq({ stage: "audience", brief: { topic: "Onboarding deck for the support team" } })).suggestions[0]).toBe("New hires");
    expect(mockSuggest(suggestReq({ stage: "audience" })).suggestions).toEqual(["Executive leadership", "Prospective clients", "Investors", "Internal team", "Conference audience"]);
  });

  it("mustInclude mixes topic-derived points with the standard ones and skips points already in the brief", () => {
    const out = mockSuggest(suggestReq({ stage: "mustInclude", brief: { topic: "Atlas analytics launch for mid-market retailers", mustInclude: ["Results and proof"] } }));
    expect(out.suggestions).not.toContain("Results and proof");
    expect(out.suggestions).toContain("Timeline and next steps");
    expect(out.suggestions).toContain("Pricing / investment");
    expect(out.suggestions).toContain("Team and credentials");
    expect(out.suggestions.length).toBeGreaterThanOrEqual(4);
    expect(out.suggestions.length).toBeLessThanOrEqual(6);
  });

  it("confirm starts with the build option and swaps the pricing tweak when pricing is already covered", () => {
    const plain = mockSuggest(suggestReq({ stage: "confirm", brief: { topic: "Atlas" } }));
    expect(plain.suggestions[0]).toBe("Looks right, build the outline");
    expect(plain.suggestions).toContain("Add a pricing slide");
    const priced = mockSuggest(suggestReq({ stage: "confirm", brief }));
    expect(priced.suggestions).not.toContain("Add a pricing slide");
    expect(priced.suggestions).toContain("Add a customer story");
  });

  it("is deterministic", () => {
    const req = suggestReq({ stage: "goal", brief });
    expect(mockSuggest(req)).toEqual(mockSuggest(req));
  });
});

describe("mockOutline", () => {
  const brief = {
    topic: "AI-powered expense tracking app for small businesses",
    audience: "Investors",
    goal: "Raise a seed round",
    mustInclude: ["Market size", "The team"],
    angle: "Problem → solution → proof",
  };
  const validOutline = (o: Outline) => {
    const parsed = OutlineSchema.safeParse(o);
    expect(parsed.success, JSON.stringify(parsed.success ? null : parsed.error.issues)).toBe(true);
  };

  it.each([3, 5, 10, 20])("chat mode: returns exactly slideCount=%i slides, cover first, closing last, with goals and 2 to 4 key points", (slideCount) => {
    const out = mockOutline(outlineReq({ mode: "chat", brief, slideCount }));
    validOutline(out);
    expect(out.slides).toHaveLength(slideCount);
    expect(out.slides[0].kind).toBe("cover");
    expect(out.slides[slideCount - 1].kind).toBe("closing");
    for (const s of out.slides.slice(1, -1)) expect(["cover", "closing"]).not.toContain(s.kind);
    for (const s of out.slides) {
      expect(s.goal).toBeTruthy();
      expect(s.keyPoints?.length).toBeGreaterThanOrEqual(2);
      expect(s.keyPoints?.length).toBeLessThanOrEqual(4);
    }
  });

  it("chat mode: uses the brief's topic, audience, goal and must-include points", () => {
    const out = mockOutline(outlineReq({ mode: "chat", brief, slideCount: 10 }));
    expect(out.title).toBe("AI-powered expense tracking app for small businesses");
    expect(out.audience).toBe("Investors");
    const titles = out.slides.map((s) => s.title);
    expect(titles).toContain("Market Size");
    expect(titles).toContain("The Team");
    expect(JSON.stringify(out)).toContain("Raise a seed round");
    const kinds = new Set(out.slides.map((s) => s.kind));
    expect(kinds.size).toBeGreaterThanOrEqual(5);
  });

  it("chat mode: keeps must-include slides even when the deck is short", () => {
    const out = mockOutline(outlineReq({ mode: "chat", brief, slideCount: 4 }));
    expect(out.slides).toHaveLength(4);
    expect(out.slides.map((s) => s.title)).toEqual(expect.arrayContaining(["Market Size", "The Team"]));
  });

  it("chat mode: copes with an empty brief", () => {
    const out = mockOutline(outlineReq({ mode: "chat" }));
    validOutline(out);
    expect(out.slides).toHaveLength(10);
    expect(JSON.stringify(out)).not.toMatch(/lorem|ipsum|tbd|placeholder/i);
  });

  it("paste mode: builds the outline from the source's sections with their kinds and facts", () => {
    const out = mockOutline(outlineReq({ mode: "paste", brief: { source: PASTE }, slideCount: 8 }));
    validOutline(out);
    expect(out.slides).toHaveLength(8);
    expect(out.title).toBe("Launch plan for Atlas");
    expect(out.slides[0].kind).toBe("cover");
    expect(out.slides[7].kind).toBe("closing");
    const byTitle = new Map(out.slides.map((s) => [s.title, s]));
    expect(byTitle.get("Why now")?.kind).toBe("bullets");
    expect(byTitle.get("Why now")?.keyPoints).toEqual(["Retail margins are under pressure", "Legacy BI tools take weeks to set up", "Buyers want answers, not dashboards"]);
    expect(byTitle.get("Results from the pilot")?.kind).toBe("stats");
    expect(byTitle.get("Results from the pilot")?.keyPoints?.[0]).toBe("38% faster weekly reporting");
    expect(byTitle.get("Rollout steps")?.kind).toBe("process");
    expect(byTitle.get("Atlas vs the old stack")?.kind).toBe("comparison");
    expect(byTitle.get("What customers say")?.kind).toBe("quote");
  });

  it("paste mode: pads to slideCount and caps at slideCount", () => {
    const padded = mockOutline(outlineReq({ mode: "paste", brief: { source: PASTE }, slideCount: 12 }));
    validOutline(padded);
    expect(padded.slides).toHaveLength(12);
    expect(padded.slides.at(-1)?.kind).toBe("closing");
    const capped = mockOutline(outlineReq({ mode: "paste", brief: { source: PASTE }, slideCount: 4 }));
    validOutline(capped);
    expect(capped.slides).toHaveLength(4);
  });

  it("is deterministic", () => {
    const req = outlineReq({ mode: "chat", brief, slideCount: 8 });
    expect(mockOutline(req)).toEqual(mockOutline(req));
  });
});

describe("mockGenerate: outline-driven", () => {
  const brief = { topic: "Atlas analytics launch", audience: "Prospective clients", goal: "Book a pilot", mustInclude: ["Pricing model"] };
  const outline = mockOutline(outlineReq({ mode: "chat", brief, slideCount: 9 }));

  it("returns exactly one slide per outline item, in order, with matching kinds and titles", () => {
    const out = mockGenerate(genReq({ mode: "chat", input: "Atlas analytics launch", slideCount: 4, outline, brief }));
    const parsed = GenerationSchema.safeParse(out);
    expect(parsed.success, JSON.stringify(parsed.success ? null : parsed.error.issues)).toBe(true);
    expect(out.slides).toHaveLength(outline.slides.length);
    expect(out.title).toBe(outline.title);
    out.slides.forEach((s, i) => {
      expect(s.kind).toBe(outline.slides[i].kind);
      expect(s.title).toBe(outline.slides[i].title);
    });
  });

  it("derives bullets, cards, steps, stats and columns from the key points", () => {
    const custom: Outline = {
      title: "Atlas rollout",
      slides: [
        { title: "Atlas rollout", kind: "cover", goal: "Open", keyPoints: ["Prepared for the retail leadership team"] },
        { title: "What we heard", kind: "bullets", goal: "Pain", keyPoints: ["Reports take a week", "Only analysts can query", "Managers fly blind"] },
        { title: "Three pillars", kind: "cards", goal: "Solution", keyPoints: ["Live data: numbers refresh every morning", "Self-serve: managers ask their own questions", "Alerts: margin dips flagged same day"] },
        { title: "The pilot in numbers", kind: "stats", goal: "Proof", keyPoints: ["38% faster reporting", "$120k saved per store", "Manager adoption"] },
        { title: "Rollout plan", kind: "process", goal: "Plan", keyPoints: ["Pilot: five stores", "Train: regional managers", "Switch off legacy reports"] },
        { title: "Old stack vs Atlas", kind: "comparison", goal: "Contrast", keyPoints: ["Manual exports", "One analyst per region", "Live numbers", "Self-serve for every store"] },
        { title: "Let's start the pilot", kind: "closing", goal: "Ask", keyPoints: ["Pick five stores this month"] },
      ],
    };
    const out = mockGenerate(genReq({ mode: "chat", input: "Atlas", outline: custom, brand: { company: "Atlas Analytics" } }));
    expect(GenerationSchema.safeParse(out).success).toBe(true);
    expect(out.slides).toHaveLength(7);
    expect(out.slides[0].subtitle).toBe("Atlas Analytics · Prepared for the retail leadership team");
    expect(out.slides[1].bullets).toEqual(["Reports take a week", "Only analysts can query", "Managers fly blind"]);
    expect(out.slides[2].cards?.map((c) => c.title)).toEqual(["Live data", "Self-serve", "Alerts"]);
    expect(out.slides[2].cards?.[0].body).toBe("numbers refresh every morning");
    expect(out.slides[3].stats?.slice(0, 2)).toEqual([
      { value: "38%", label: "faster reporting" },
      { value: "$120k", label: "saved per store" },
    ]);
    expect(out.slides[3].stats?.[2].label).toBe("Manager adoption");
    expect(out.slides[3].body).toMatch(/Illustrative targets/);
    expect(out.slides[4].steps?.[0]).toEqual({ title: "Pilot", body: "five stores" });
    expect(out.slides[5].columnTitles).toEqual(["Old stack", "Atlas"]);
    expect(out.slides[5].bullets).toEqual(["Manual exports", "One analyst per region"]);
    expect(out.slides[5].bulletsRight).toEqual(["Live numbers", "Self-serve for every store"]);
    expect(out.slides[6].subtitle).toBe("Atlas Analytics · Pick five stores this month");
    for (const s of out.slides) expect(s.notes).toMatch(/^Goal of this slide: /);
  });

  it("uses brand.company in the cover and closing without an outline too", () => {
    const chat = mockGenerate(genReq({ mode: "chat", input: "Create a deck about our onboarding programme", slideCount: 5, brand: { company: "Northwind" } }));
    expect(chat.slides[0].subtitle?.startsWith("Northwind · ")).toBe(true);
    expect(chat.slides[4].subtitle?.startsWith("Northwind · ")).toBe(true);
    const paste = mockGenerate(genReq({ mode: "paste", input: PASTE, slideCount: 6, brand: { company: "Northwind" } }));
    expect(paste.slides[0].subtitle?.startsWith("Northwind · ")).toBe(true);
    expect(paste.slides.at(-1)?.subtitle?.startsWith("Northwind · ")).toBe(true);
    expect(GenerationSchema.safeParse(paste).success).toBe(true);
  });

  it("falls back to the brief's audience when the request has none", () => {
    const out = mockGenerate(genReq({ mode: "chat", input: "Create a deck about our onboarding programme", slideCount: 5, brief: { audience: "new hires" } }));
    expect(out.slides[0].subtitle).toContain("for new hires");
  });
});

describe("mockRevise: element scope", () => {
  const textEl = (id: string, role: TextElement["role"], html: string, fontSize?: number): TextElement => ({
    id,
    type: "text",
    role,
    html,
    x: 0,
    y: 0,
    w: 800,
    h: 120,
    rotation: 0,
    z: 1,
    locked: false,
    opacity: 1,
    align: "left",
    valign: "top",
    autoFit: true,
    style: fontSize ? { fontSize } : {},
  });
  const BULLETS =
    "<ul><li>Revenue grew 24% year over year on the back of enterprise deals</li><li>net churn fell to 1.1% after the onboarding redesign</li><li>Support response times improved by a third</li></ul>";
  const BODY = "<p>we really think revenue grew strongly this quarter, and churn dropped a lot</p>";
  const richSlide: Slide = {
    id: "rich",
    layoutId: "image-right",
    background: { kind: "theme", variant: "default" },
    notes: "",
    content: { kind: "image-text", title: "Highlights of the quarter", bullets: ["placeholder"], imageQuery: "office skyline" },
    elements: [
      textEl("t", "title", "Highlights of the quarter", 72),
      textEl("b", "bullets", BULLETS),
      textEl("p", "body", BODY),
      { id: "img", type: "image", x: 0, y: 0, w: 600, h: 400, rotation: 0, z: 4, locked: false, opacity: 1, query: "office skyline", alt: "", fit: "cover", radius: 24, position: "50% 50%", overlay: 0 },
      {
        id: "c",
        type: "card",
        x: 0,
        y: 0,
        w: 500,
        h: 300,
        rotation: 0,
        z: 5,
        locked: false,
        opacity: 1,
        variant: "surface",
        title: "Onboarding redesign",
        body: "New customers reach value in two days thanks to guided setup, and support tickets fell by a third.",
      },
    ],
  };
  const base = makeDeck();
  const deck: Deck = { ...base, slides: [base.slides[0], richSlide, base.slides[2], base.slides[3]] };
  const SLIDE = 1;

  const valid = (r: ReturnType<typeof mockRevise>) => {
    const parsed = RevisionSchema.safeParse(r);
    expect(parsed.success, JSON.stringify(parsed.success ? null : parsed.error.issues)).toBe(true);
    expect(r.summary.length).toBeLessThan(200);
  };
  /** Runs an element-scoped instruction and checks every op targets exactly that element on that slide. */
  const ask = (elementId: string, instruction: string, extra: Partial<ReviseSelection> = {}) => {
    const r = mockRevise({ deck, instruction, selection: { slideIndex: SLIDE, elementId, ...extra } });
    valid(r);
    for (const op of r.ops) {
      expect("slideIndex" in op ? op.slideIndex : -1).toBe(SLIDE);
      expect("elementId" in op ? op.elementId : undefined).toBe(elementId);
    }
    return r;
  };
  const only = <K extends PatchOp["op"]>(r: ReturnType<typeof mockRevise>, op: K): Extract<PatchOp, { op: K }> => {
    expect(r.ops).toHaveLength(1);
    const first = r.ops[0];
    if (first.op !== op) throw new Error(`expected ${op}, got ${first.op}`);
    return first as Extract<PatchOp, { op: K }>;
  };

  it("shorter: halves each line at a sentence or clause boundary and keeps the list shape", () => {
    const r = ask("b", "make it shorter");
    expect(only(r, "setElementText").html).toBe("<ul><li>Revenue grew 24% year over year</li><li>net churn fell to 1.1%</li><li>Support response times improved</li></ul>");
    expect(r.summary).toBe("Shortened the bullets on slide 2.");
    expect(only(ask("p", "shorter"), "setElementText").html).toBe("<p>we really think revenue grew strongly this quarter</p>");
  });

  it("shorter: leaves a short clause-less title alone and says so", () => {
    const r = ask("t", "shorter please");
    expect(r.ops).toEqual([]);
    expect(r.summary).toMatch(/already short/);
  });

  it("longer: adds a bullet to a list, appends a clause to prose, and never repeats the title into itself", () => {
    const list = only(ask("b", "longer"), "setElementText").html;
    expect(list).toBe(`${BULLETS.slice(0, -5)}<li>What this means in practice for highlights of the quarter</li></ul>`);
    expect(only(ask("p", "expand this"), "setElementText").html).toBe("<p>we really think revenue grew strongly this quarter, and churn dropped a lot, which matters for highlights of the quarter.</p>");
    expect(only(ask("t", "make it longer"), "setElementText").html).toBe("Highlights of the quarter: what it means for quarterly review");
  });

  it("rewrite: turns sentences around at a connective and title-cases titles", () => {
    expect(only(ask("b", "rewrite this"), "setElementText").html).toBe(
      "<ul><li>On the back of enterprise deals, revenue grew 24% year over year.</li><li>After the onboarding redesign, net churn fell to 1.1%.</li><li>Support response times improved by a third.</li></ul>",
    );
    expect(only(ask("p", "rewrite"), "setElementText").html).toBe("<p>Churn dropped a lot: we think revenue grew strongly this quarter.</p>");
    expect(only(ask("t", "rewrite"), "setElementText").html).toBe("Highlights of the Quarter");
  });

  it("punchier: keeps the leading clause, drops hedges and ends hard", () => {
    expect(only(ask("b", "punchier"), "setElementText").html).toBe("<ul><li>Revenue grew 24% year over year.</li><li>Net churn fell to 1.1%.</li><li>Support response times improved by a third.</li></ul>");
    const body = ask("p", "make it punchier");
    expect(only(body, "setElementText").html).toBe("<p>We think revenue grew strongly this quarter.</p>");
    expect(body.summary).toBe("Made the body on slide 2 punchier.");
    const tight = ask("t", "punchier");
    expect(tight.ops).toEqual([]);
    expect(tight.summary).toMatch(/already tight/);
  });

  it("fix grammar: capitalises sentence starts and punctuates prose", () => {
    expect(only(ask("b", "fix grammar"), "setElementText").html).toBe(
      "<ul><li>Revenue grew 24% year over year on the back of enterprise deals</li><li>Net churn fell to 1.1% after the onboarding redesign</li><li>Support response times improved by a third</li></ul>",
    );
    expect(only(ask("p", "fix the grammar"), "setElementText").html).toBe("<p>We really think revenue grew strongly this quarter, and churn dropped a lot.</p>");
    const clean = ask("t", "check the spelling");
    expect(clean.ops).toEqual([]);
    expect(clean.summary).toMatch(/No grammar fixes needed/);
  });

  it("translate to X: prefixes [X] and flags offline mode in the summary", () => {
    const r = ask("b", "translate to French");
    expect(only(r, "setElementText").html).toBe(BULLETS.replace("<li>Revenue", "<li>[French] Revenue"));
    expect(r.summary).toMatch(/French/);
    expect(r.summary).toMatch(/offline/i);
    expect(only(ask("p", "translate this into Brazilian Portuguese"), "setElementText").html).toBe(BODY.replace("<p>we", "<p>[Brazilian Portuguese] we"));
  });

  it("bigger / smaller: steps a text element's fontSize by 4 from its current or role default size", () => {
    expect(only(ask("t", "bigger"), "setElementStyle").style).toEqual({ fontSize: 72 + FONT_STEP });
    expect(only(ask("b", "make it smaller"), "setElementStyle").style).toEqual({ fontSize: TYPE_SCALE.bullets - FONT_STEP });
    expect(only(ask("b", "increase the font size"), "setElementStyle").style).toEqual({ fontSize: TYPE_SCALE.bullets + FONT_STEP });
  });

  it("bigger / smaller: scales the box of images and cards instead", () => {
    expect(only(ask("img", "bigger"), "setElementBox")).toMatchObject({ w: 750, h: 500 });
    expect(only(ask("c", "smaller"), "setElementBox")).toMatchObject({ w: 400, h: 240 });
  });

  it("color / colour: maps names and hex to a text colour", () => {
    expect(only(ask("t", "color red"), "setElementStyle").style).toEqual({ color: "#E5484D" });
    expect(only(ask("t", "make it coral"), "setElementStyle").style).toEqual({ color: "#F05A3C" });
    expect(only(ask("t", "change the colour to navy"), "setElementStyle").style).toEqual({ color: COLOR_NAMES.navy });
    expect(only(ask("t", "colour #1a2b3c"), "setElementStyle").style).toEqual({ color: "#1A2B3C" });
    expect(only(ask("t", "colour #abc"), "setElementStyle").style).toEqual({ color: "#AABBCC" });
    for (const name of ["red", "blue", "green", "orange", "black", "white", "grey", "gray", "coral", "navy"]) {
      expect(COLOR_NAMES[name]).toMatch(/^#[0-9A-F]{6}$/);
      expect(only(ask("b", `colour ${name}`), "setElementStyle").style).toEqual({ color: COLOR_NAMES[name] });
    }
    expect(COLOR_NAMES.grey).toBe(COLOR_NAMES.gray);
    const notText = ask("img", "color red");
    expect(notText.ops).toEqual([]);
    expect(notText.summary).toMatch(/text element/);
  });

  it("center / left / right: sets align on a text element", () => {
    expect(only(ask("t", "center it"), "setElementStyle").style).toEqual({ align: "center" });
    expect(only(ask("t", "align right"), "setElementStyle").style).toEqual({ align: "right" });
    expect(only(ask("t", "left align"), "setElementStyle").style).toEqual({ align: "left" });
    expect(only(ask("p", "centre this"), "setElementStyle").style).toEqual({ align: "center" });
  });

  it("new image idea: builds a fresh query from the slide title, deterministically", () => {
    const r = ask("img", "new image idea");
    const op = only(r, "setImage");
    expect(op.query).toBeDefined();
    expect(op.query).toMatch(/^Highlights of the quarter, /);
    expect(op.query).not.toBe("office skyline");
    expect(op.query?.length ?? 0).toBeLessThanOrEqual(140);
    expect(op.src).toBeUndefined();
    expect(only(ask("img", "give me a different picture"), "setImage").query).toBe(op.query);
    expect(r.summary).toContain(op.query ?? "");
  });

  it("describe as X: sets the image query verbatim", () => {
    expect(only(ask("img", "describe it as a team celebrating in a warm office"), "setImage").query).toBe("a team celebrating in a warm office");
  });

  it("card: rewrite title / rewrite body / rewrite both", () => {
    expect(only(ask("c", "rewrite title"), "setCard")).toEqual({ op: "setCard", slideIndex: SLIDE, elementId: "c", title: "Onboarding Redesign" });
    const body = only(ask("c", "rewrite the body"), "setCard");
    expect(body.title).toBeUndefined();
    expect(body.body).toBe("Thanks to guided setup, new customers reach value in two days, and support tickets fell by a third.");
    const both = only(ask("c", "rewrite"), "setCard");
    expect(both.title).toBe("Onboarding Redesign");
    expect(both.body).toBe(body.body);
  });

  it("card: shorter, translate and grammar act on the card fields", () => {
    expect(only(ask("c", "shorter"), "setCard").body).toBe("New customers reach value in two days thanks to guided setup.");
    const de = only(ask("c", "translate to German"), "setCard");
    expect(de.title).toBe("[German] Onboarding redesign");
    expect(de.body?.startsWith("[German] New customers")).toBe(true);
    expect(de.body?.length ?? 0).toBeLessThanOrEqual(140);
    const clean = ask("c", "fix grammar");
    expect(clean.ops).toEqual([]);
  });

  it("delete this / duplicate this: element ops, while 'delete this slide' still removes the slide", () => {
    expect(only(ask("t", "delete this"), "deleteElement")).toEqual({ op: "deleteElement", slideIndex: SLIDE, elementId: "t" });
    expect(only(ask("img", "remove it"), "deleteElement").elementId).toBe("img");
    expect(only(ask("c", "duplicate this"), "duplicateElement")).toEqual({ op: "duplicateElement", slideIndex: SLIDE, elementId: "c" });
    const slide = mockRevise({ deck, instruction: "delete this slide", selection: { slideIndex: SLIDE, elementId: "t" } });
    valid(slide);
    expect(slide.ops).toEqual<PatchOp[]>([{ op: "deleteSlide", slideIndex: SLIDE }]);
  });

  it("falls back to slide / deck heuristics when the instruction is not element-specific", () => {
    const add = mockRevise({ deck, instruction: "add a slide about pricing", selection: { slideIndex: SLIDE, elementId: "t" } });
    valid(add);
    expect(only(add, "insertSlide").atIndex).toBe(SLIDE + 1);
    const theme = mockRevise({ deck, instruction: "theme midnight", selection: { slideIndex: SLIDE, elementId: "t" } });
    expect(theme.ops).toEqual<PatchOp[]>([{ op: "setTheme", themeId: "midnight" }]);
    const unknown = ask("t", "what is love");
    expect(unknown.ops).toEqual([]);
    expect(unknown.summary).toBe("I could not map that request in offline mode.");
  });

  it("a selection without an element scopes to its slide", () => {
    const r = mockRevise({ deck, instruction: "make this shorter", selection: { slideIndex: 2 } });
    valid(r);
    expect(only(r, "replaceSlideContent").slideIndex).toBe(2);
    const explicit = mockRevise({ deck, instruction: "make this shorter", selectedSlideIndex: 3, selection: { slideIndex: 2 } });
    expect(only(explicit, "replaceSlideContent").slideIndex).toBe(3);
  });

  it("uses the selection's text and type when the element id is not in the deck", () => {
    const r = ask("ghost", "shorter", { elementType: "text", role: "body", text: "Revenue grew 24% year over year on the back of enterprise deals" });
    expect(only(r, "setElementText").html).toBe("Revenue grew 24% year over year");
    const size = ask("ghost", "bigger", { elementType: "text", role: "caption" });
    expect(only(size, "setElementStyle").style).toEqual({ fontSize: TYPE_SCALE.caption + FONT_STEP });
    const nothing = mockRevise({ deck, instruction: "shorter", selection: { slideIndex: SLIDE, elementId: "ghost" } });
    valid(nothing);
    expect(only(nothing, "replaceSlideContent").slideIndex).toBe(SLIDE);
  });

  it("ignores a selection whose slide index is out of range", () => {
    const r = mockRevise({ deck, instruction: "delete this", selection: { slideIndex: 40, elementId: "t" } });
    valid(r);
    expect(r.ops).toEqual([]);
  });

  it("is deterministic", () => {
    const a = mockRevise({ deck, instruction: "rewrite this", selection: { slideIndex: SLIDE, elementId: "b" } });
    const b = mockRevise({ deck, instruction: "rewrite this", selection: { slideIndex: SLIDE, elementId: "b" } });
    expect(a).toEqual(b);
  });
});
