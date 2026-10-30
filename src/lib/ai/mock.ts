import {
  ThemeIdSchema,
  type Brief,
  type Element,
  type ElementType,
  type GenerateRequest,
  type Generation,
  type Outline,
  type OutlineItem,
  type OutlineRequest,
  type PatchOp,
  type ReviseRequest,
  type ReviseSelection,
  type Revision,
  type SlideContent,
  type SlideKind,
  type SuggestRequest,
  type SuggestResponse,
  type TextRole,
  type ThemeId,
} from "@/lib/deck/schema";
import { TYPE_SCALE } from "@/lib/deck/layouts";
import { htmlToText } from "@/lib/text";
import { deriveContent } from "./slide-text";

/**
 * Offline generator and reviser. Fully deterministic: the same input always
 * yields the same output, and nothing here uses randomness or the network.
 */

/* ------------------------------------------------------------------ */
/* Limits and text helpers                                             */
/* ------------------------------------------------------------------ */

const LIMIT = {
  deckTitle: 80,
  title: 90,
  subtitle: 160,
  body: 400,
  bullet: 110,
  columnTitle: 40,
  cardTitle: 50,
  cardBody: 140,
  statValue: 14,
  statLabel: 50,
  stepTitle: 40,
  stepBody: 120,
  quoteText: 220,
  quoteBy: 60,
  imageQuery: 140,
  notes: 400,
  summary: 200,
  outlineTitle: 80,
  outlineGoal: 140,
  keyPoint: 100,
  suggestion: 120,
  hint: 200,
} as const;

/** Collapse whitespace and truncate at a word boundary, adding an ellipsis when cut. */
export function clip(input: string, max: number): string {
  const text = input.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  if (max <= 1) return text.slice(0, max);
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  const base = (space >= Math.floor(max * 0.5) ? cut.slice(0, space) : cut).replace(/[\s,;:.\-–—(]+$/u, "");
  return `${base || cut.trimEnd()}…`;
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function titleCase(s: string): string {
  const small = new Set(["a", "an", "the", "and", "or", "of", "for", "to", "in", "on", "at", "by", "with", "vs", "from", "as"]);
  return s
    .split(" ")
    .map((w, i) => (i > 0 && small.has(w.toLowerCase()) ? w.toLowerCase() : capitalize(w)))
    .join(" ");
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function lowerFirst(s: string): string {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

/** Lower-case alphanumeric key used to compare phrases regardless of punctuation and case. */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9“"(])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const STOP_WORDS = new Set(
  "a an the and or but of for to in on at by with from as is are was were be been being this that these those it its our your their my we you they i me us them about into over under after before between through during without within also just very really can could should would will shall may might must do does did done have has had having make makes made create creates build builds generate presentation deck slides slide pitch talk please want need like some any more most such than then there here what which who whom whose how when where why all each every both few many much several own same so too s t".split(
    " ",
  ),
);

/* ------------------------------------------------------------------ */
/* Paste mode: split into sections                                     */
/* ------------------------------------------------------------------ */

type Section = { title: string; lines: string[] };

const HEADING_RE = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/;
const BULLET_RE = /^\s*(?:[-*•·–—]|\d{1,3}[.)]|\(\d{1,3}\)|[a-z][.)])\s+(.*)$/i;
const NUMBERED_RE = /^\s*(?:\d{1,3}[.)]|\(\d{1,3}\))\s+/;

function stripBullet(line: string): string {
  const m = BULLET_RE.exec(line);
  return (m ? m[1] : line).trim();
}

function titleFromSentence(line: string): string {
  const first = sentences(stripBullet(line))[0] ?? line;
  const cleaned = first.replace(/[.!?:]+$/, "").trim();
  return clip(capitalize(cleaned), 60);
}

function isTitleLike(line: string): boolean {
  return !BULLET_RE.test(line) && line.length <= 90 && !/[.!?]$/.test(line.trim());
}

function splitSections(text: string): Section[] {
  const normalized = text.replace(/\r\n?/g, "\n");
  const rawLines = normalized.split("\n");
  const sections: Section[] = [];

  if (rawLines.some((l) => HEADING_RE.test(l))) {
    let current: Section | null = null;
    for (const raw of rawLines) {
      const h = HEADING_RE.exec(raw);
      if (h) {
        current = { title: h[2].trim(), lines: [] };
        sections.push(current);
        continue;
      }
      const t = raw.trim();
      if (!t) continue;
      if (!current) {
        current = { title: "", lines: [] };
        sections.push(current);
      }
      current.lines.push(t);
    }
  } else {
    const paragraphs = normalized
      .split(/\n[ \t]*\n+/)
      .map((p) => p.split("\n").map((l) => l.trim()).filter(Boolean))
      .filter((p) => p.length > 0);

    for (let i = 0; i < paragraphs.length; i++) {
      const p = paragraphs[i];
      const next = paragraphs[i + 1];
      const allBullets = (lines: string[]) => lines.length > 0 && lines.every((l) => BULLET_RE.test(l));
      // "Heading line" paragraph followed by a list paragraph → one section.
      if (p.length === 1 && isTitleLike(p[0]) && next && allBullets(next)) {
        sections.push({ title: p[0].replace(/:$/, ""), lines: next });
        i++;
        continue;
      }
      // Heading line followed by a list inside the same paragraph.
      if (p.length > 1 && isTitleLike(p[0]) && allBullets(p.slice(1))) {
        sections.push({ title: p[0].replace(/:$/, ""), lines: p.slice(1) });
        continue;
      }
      sections.push({ title: "", lines: p });
    }
  }

  const titled = sections
    .map((s): Section => {
      if (s.title) return s;
      const first = s.lines[0] ?? "";
      if (s.lines.length > 1 && isTitleLike(first)) return { title: first.replace(/:$/, ""), lines: s.lines.slice(1) };
      return { title: titleFromSentence(first), lines: s.lines };
    })
    .filter((s) => s.title || s.lines.length > 0);

  // Long sections are chunked so every slide stays within the content limits.
  const chunked: Section[] = [];
  for (const s of titled) {
    const listy = s.lines.filter((l) => BULLET_RE.test(l)).length >= Math.ceil(s.lines.length / 2);
    if (listy && s.lines.length > 6) {
      for (let i = 0, part = 1; i < s.lines.length; i += 5, part++) {
        chunked.push({ title: part === 1 ? s.title : `${clip(s.title, 70)} (cont.)`, lines: s.lines.slice(i, i + 5) });
      }
    } else {
      chunked.push(s);
    }
  }
  return chunked;
}

/* ------------------------------------------------------------------ */
/* Paste mode: choose a slide kind by shape                            */
/* ------------------------------------------------------------------ */

const STAT_RE = /(?:[$€£¥]\s?\d[\d,.]*\s?(?:k|m|b|bn|mn|million|billion)?(?![\w%])|\d[\d,.]*\s?(?:%|percent\b|×|x\b|k\b|m\b|b\b|bn\b|mn\b|million\b|billion\b|pts?\b|days?\b|hours?\b|hrs?\b|weeks?\b|months?\b|years?\b|yrs?\b|min(?:ute)?s?\b|sec(?:ond)?s?\b|users?\b|customers?\b|stores?\b|teams?\b|countries\b|markets?\b)|\b\d[\d,.]*\+)/i;
const PROCESS_RE = /\b(?:step|phase|stage|milestone|first(?:ly)?|second(?:ly)?|third(?:ly)?|fourth|fifth|then|next|finally|lastly|week\s*\d|day\s*\d|month\s*\d|q[1-4]\b)/i;
const QUOTE_RE = /^(?:>\s*)?[“"'‘](.{8,}?)[”"'’](?:\s*[—–-]+\s*(.+))?$/;
const VS_RE = /\b(?:vs\.?|versus)\b|\bcompared?\s+(?:to|with)\b|\bbefore\s+(?:and|&|\/)\s+after\b|\bpros?\s+(?:and|&|\/)\s+cons?\b/i;

function splitPair(line: string): { head: string; rest: string } {
  const m = /^(.{2,60}?)\s*(?::|—|–|\s-\s)\s*(.+)$/.exec(line);
  if (m) return { head: m[1].trim(), rest: m[2].trim() };
  return { head: "", rest: line };
}

function bulletsFrom(lines: string[], max = 6): string[] {
  return lines.map(stripBullet).filter(Boolean).slice(0, max).map((l) => clip(l, LIMIT.bullet));
}

/** A section is quotable when one of its lines is a quoted sentence; the attribution may follow on the next line. */
function quoteFromLines(lines: string[], title: string): SlideContent | undefined {
  const quoted = lines.map((l) => QUOTE_RE.exec(l.trim())).find((m): m is RegExpExecArray => m !== null);
  if (!quoted) return undefined;
  const idx = lines.findIndex((l) => QUOTE_RE.test(l.trim()));
  const following = lines[idx + 1]?.trim() ?? "";
  const byLine = /^[—–-]+\s*(.+)$/.exec(following)?.[1];
  const by = quoted[2] ?? byLine;
  const content: SlideContent = { kind: "quote", title, quote: { text: clip(quoted[1], LIMIT.quoteText) } };
  if (by) content.quote = { ...content.quote!, by: clip(by, LIMIT.quoteBy) };
  return content;
}

/** Two headed halves ("Before:" ... "After:" ...) or a "vs" title split down the middle. */
function comparisonFromLines(lines: string[], clean: string[], title: string): SlideContent | undefined {
  const headers = lines
    .map((l, i) => ({ l: l.trim(), i }))
    .filter(({ l }) => /:$/.test(l) && !BULLET_RE.test(l) && l.length <= 41);
  if (headers.length === 2 && headers[1].i > headers[0].i + 1) {
    const left = lines.slice(headers[0].i + 1, headers[1].i);
    const right = lines.slice(headers[1].i + 1);
    if (left.length && right.length) {
      return {
        kind: "comparison",
        title,
        columnTitles: [clip(headers[0].l.replace(/:$/, ""), LIMIT.columnTitle), clip(headers[1].l.replace(/:$/, ""), LIMIT.columnTitle)],
        bullets: bulletsFrom(left),
        bulletsRight: bulletsFrom(right),
      };
    }
  }
  if (VS_RE.test(title) && clean.length >= 2) {
    const parts = title.split(VS_RE).map((p) => p.trim()).filter(Boolean);
    const [a, b] = parts.length >= 2 ? parts : ["Before", "After"];
    const half = Math.ceil(clean.length / 2);
    return {
      kind: "comparison",
      title,
      columnTitles: [clip(a, LIMIT.columnTitle), clip(b, LIMIT.columnTitle)],
      bullets: bulletsFrom(clean.slice(0, half)),
      bulletsRight: bulletsFrom(clean.slice(half)),
    };
  }
  return undefined;
}

/** Step / phase / ordinal words, or a numbered list of at least three items. */
function processFromLines(lines: string[], clean: string[], title: string): SlideContent | undefined {
  const processHits = clean.filter((l) => PROCESS_RE.test(l)).length;
  const numbered = lines.filter((l) => NUMBERED_RE.test(l)).length;
  if (clean.length < 2 || clean.length > 6) return undefined;
  if (!(processHits >= 2 || PROCESS_RE.test(title) || (numbered >= 3 && numbered === lines.length))) return undefined;
  return {
    kind: "process",
    title,
    steps: clean.slice(0, 6).map((l, i) => {
      const { head, rest } = splitPair(l);
      return {
        title: clip(head || `Step ${i + 1}`, LIMIT.stepTitle),
        body: clip(rest, LIMIT.stepBody),
      };
    }),
  };
}

/** At least two lines, and at least half of them, carry a number or percentage. */
function statsFromLines(clean: string[], title: string): SlideContent | undefined {
  const statLines = clean.filter((l) => STAT_RE.test(l));
  if (statLines.length < 2 || statLines.length < Math.ceil(clean.length / 2)) return undefined;
  return {
    kind: "stats",
    title,
    stats: statLines.slice(0, 4).map((l) => {
      const m = STAT_RE.exec(l);
      const value = (m?.[0] ?? "").replace(/\s+/g, "").trim();
      const label = l.replace(m?.[0] ?? "", "").replace(/^[\s:—–\-,.]+|[\s:—–\-,.]+$/g, "").trim();
      return { value: clip(value, LIMIT.statValue), label: clip(label || title, LIMIT.statLabel) };
    }),
  };
}

/** Three or four "Name: description" lines. */
function cardsFromLines(clean: string[], title: string): SlideContent | undefined {
  if (clean.length < 3 || clean.length > 4 || !clean.every((l) => splitPair(l).head)) return undefined;
  return {
    kind: "cards",
    title,
    cards: clean.map((l) => {
      const { head, rest } = splitPair(l);
      return { title: clip(head, LIMIT.cardTitle), body: clip(rest, LIMIT.cardBody) };
    }),
  };
}

/** Fallback: short lists become bullets, prose becomes a body plus sentence bullets, long lists are truncated. */
function bulletsFromLines(clean: string[], title: string): SlideContent {
  if (clean.length >= 3 && clean.length <= 6 && clean.every((l) => l.length <= LIMIT.bullet)) {
    return { kind: "bullets", title, bullets: bulletsFrom(clean) };
  }
  if (clean.length === 0) return { kind: "section", title };
  if (clean.length <= 2) {
    const prose = clean.join(" ");
    const points = sentences(prose).filter((s) => s.length > 12);
    const content: SlideContent = { kind: "bullets", title, body: clip(prose, LIMIT.body) };
    if (points.length >= 2) content.bullets = points.slice(0, 5).map((s) => clip(s.replace(/[.!?]$/, ""), LIMIT.bullet));
    return content;
  }
  return { kind: "bullets", title, bullets: bulletsFrom(clean) };
}

/** Pick the slide kind that best matches the shape of a section's lines. Detectors run from most to least specific. */
function shapeSection(section: Section, index: number): SlideContent {
  const title = clip(section.title || `Section ${index + 1}`, LIMIT.title);
  const lines = section.lines;
  const clean = lines.map(stripBullet).filter(Boolean);
  return (
    quoteFromLines(lines, title) ??
    comparisonFromLines(lines, clean, title) ??
    processFromLines(lines, clean, title) ??
    statsFromLines(clean, title) ??
    cardsFromLines(clean, title) ??
    bulletsFromLines(clean, title)
  );
}

/* ------------------------------------------------------------------ */
/* Paste mode: assemble the deck                                       */
/* ------------------------------------------------------------------ */

type ParsedSource = { text: string; deckTitle: string; coverSubtitle?: string; sections: Section[] };

/** Shared by paste-mode generation and outlining: title, optional cover line and the body sections of pasted material. */
function parseSource(input: string): ParsedSource {
  const text = input.replace(/\r\n?/g, "\n").trim();
  const firstH1 = text.split("\n").map((l) => /^\s{0,3}#\s+(.+?)\s*#*\s*$/.exec(l)?.[1]).find(Boolean);
  let sections = splitSections(text);

  let deckTitle: string;
  let coverSubtitle: string | undefined;
  if (firstH1 && sections.length > 1 && sections[0].title === firstH1.trim()) {
    deckTitle = firstH1.trim();
    coverSubtitle = sections[0].lines.length ? clip(sections[0].lines.map(stripBullet).join(" "), LIMIT.subtitle) : undefined;
    sections = sections.slice(1);
  } else {
    deckTitle = sections[0]?.title || titleFromSentence(text);
  }
  return { text, deckTitle: clip(deckTitle, LIMIT.deckTitle), coverSubtitle, sections };
}

/** Middle slides for pasted material: one per section, padded with an agenda and takeaways towards `middleBudget`. */
function pasteMiddle(source: ParsedSource, middleBudget: number): SlideContent[] {
  const middle: SlideContent[] = source.sections.slice(0, middleBudget).map(shapeSection);

  if (middle.length === 0) {
    middle.push({ kind: "bullets", title: clip(source.deckTitle, LIMIT.title), body: clip(source.text, LIMIT.body) });
  }

  // Fill towards the requested count with an agenda and a takeaways slide built from the source.
  const sectionTitles = middle.map((s) => s.title);
  if (middle.length < middleBudget && sectionTitles.length >= 3) {
    middle.unshift({ kind: "bullets", title: "Agenda", bullets: sectionTitles.slice(0, 6).map((t) => clip(t, LIMIT.bullet)) });
  }
  if (middle.length < middleBudget) {
    const takeaways = middle
      .filter((s) => s.title !== "Agenda")
      .map((s) => s.bullets?.[0] ?? s.steps?.[0]?.body ?? s.cards?.[0]?.body ?? s.stats?.map((st) => `${st.value} ${st.label}`)[0] ?? s.body ?? s.quote?.text ?? "")
      .filter(Boolean);
    if (takeaways.length >= 2) {
      middle.push({ kind: "bullets", title: "Key takeaways", bullets: takeaways.slice(0, 6).map((t) => clip(t, LIMIT.bullet)) });
    }
  }
  return middle.slice(0, middleBudget);
}

/** Company prefix for cover and closing subtitles when brand preferences name one. */
function withCompany(company: string | undefined, line: string, max: number): string {
  const name = company?.trim();
  return clip(name ? `${name} · ${line}` : line, max);
}

function pasteGeneration(req: GenerateRequest): Generation {
  const source = parseSource(req.input);
  const { deckTitle } = source;
  const target = Math.max(3, Math.min(20, req.slideCount));
  const middle = pasteMiddle(source, target - 2);
  const topicCount = middle.filter((s) => s.title !== "Agenda" && s.title !== "Key takeaways").length;

  const audience = req.audience?.trim() || req.brief?.audience?.trim();
  const company = req.brand?.company;
  const cover: SlideContent = {
    kind: "cover",
    title: clip(deckTitle, LIMIT.title),
    subtitle: withCompany(company, source.coverSubtitle ?? (audience ? `Prepared for ${audience}` : `${topicCount} topics, ${req.tone}`), LIMIT.subtitle),
    imageQuery: clip(`${deckTitle} abstract editorial photo, ${req.tone} mood`, LIMIT.imageQuery),
  };
  const closing: SlideContent = {
    kind: "closing",
    title: "Thank you",
    subtitle: withCompany(company, `Questions and next steps on ${deckTitle}`, LIMIT.subtitle),
    imageQuery: clip(`${deckTitle} horizon, calm closing image`, LIMIT.imageQuery),
  };

  return { title: deckTitle, slides: [cover, ...middle, closing] };
}

/* ------------------------------------------------------------------ */
/* Chat mode                                                           */
/* ------------------------------------------------------------------ */

const REQUEST_PREFIX_RE =
  /^(?:(?:hi|hello|hey)[,!.\s]+)?(?:please\s+)?(?:can you\s+|could you\s+|would you\s+|i(?:'d| would)? (?:like|need|want)(?: you)?(?: to)?\s+|help me\s+|let's\s+)?(?:please\s+)?(?:create|make|build|generate|write|draft|prepare|design|produce|put together|do)\s+(?:me\s+|us\s+)?(?:a|an|the|my|our)?\s*(?:\d+[- ]slides?\s+)?(?:short|quick|brief|simple|compelling|professional|detailed)?\s*(?:pitch\s+deck|sales\s+deck|deck|presentation|slides?|slideshow|slide\s+deck|keynote|talk|pitch|overview)\s*(?:about|on|for|covering|explaining|introducing|describing|presenting|that\s+(?:covers|explains|introduces|presents))?\s*/i;

function chatTopicAndPhrases(prompt: string): { topic: string; phrases: string[]; audienceHint?: string } {
  const lines = prompt
    .split("\n")
    .map((l) => l.replace(/^\s*(?:user|assistant|me|you)\s*:\s*/i, "").trim())
    .filter(Boolean);
  const first = lines[0] ?? prompt.trim();

  let topic = first.replace(REQUEST_PREFIX_RE, "").trim();
  const forMatch = /\s+(?:for|aimed at|targeting)\s+((?:the\s+)?[a-z][a-z\s-]{2,40}?)(?=[,.;]|\s+(?:covering|including|that|which|with)\b|$)/i.exec(topic);
  const audienceHint = forMatch?.[1]?.trim();
  const topicCut = topic.split(/,|;|\s+covering\s+|\s+including\s+|\s+that\s+covers\s+|\s+with\s+sections\s+/i)[0] ?? topic;
  topic = topicCut.replace(/^(?:our|my|the|a|an)\s+/i, "").replace(/[.!?:]+$/, "").trim();
  if (!topic) topic = first.replace(/[.!?]+$/, "").trim();
  if (!topic) topic = "Your presentation";
  topic = clip(capitalize(topic), 60);

  const fragments = lines
    .join(". ")
    .split(/[,;.!?\n()]|\s+(?:and|or|plus|including|covering|then|also|with)\s+/i)
    .map((f) => f.replace(REQUEST_PREFIX_RE, "").replace(/^(?:the|a|an|our|my|some|about|on)\s+/i, "").replace(/[.!?:]+$/, "").trim())
    .filter((f) => {
      const words = f.split(/\s+/);
      const significant = words.filter((w) => !STOP_WORDS.has(w.toLowerCase()));
      return f.length >= 3 && f.length <= 60 && words.length <= 8 && significant.length >= 1 && f.toLowerCase() !== topic.toLowerCase();
    });
  const phrases: string[] = [];
  for (const f of fragments) {
    const key = f.toLowerCase();
    if (!phrases.some((p) => p.toLowerCase() === key)) phrases.push(f);
  }
  if (phrases.length < 3) {
    const words = prompt
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOP_WORDS.has(w));
    for (const w of words) {
      if (phrases.length >= 6) break;
      if (!phrases.some((p) => p.toLowerCase() === w)) phrases.push(w);
    }
  }
  return { topic, phrases, audienceHint };
}

const CHAT_KINDS: SlideKind[] = ["bullets", "cards", "stats", "image-text", "process", "comparison", "quote", "two-column", "section"];
const ICONS = ["Target", "Lightning", "Users", "ChartLineUp", "ShieldCheck", "Rocket", "Globe", "Lightbulb"];

type ChatSlideContext = {
  topic: string;
  /** Capitalised lead phrase for this slide. */
  focus: string;
  audience: string;
  tone: string;
  seed: number;
  /** The n-th phrase after this slide's own, wrapping around; the topic when there are none. */
  pick: (n: number) => string;
};

const t = (s: string) => clip(s, LIMIT.title);
const b = (s: string) => clip(s, LIMIT.bullet);

const CHAT_SLIDES: Partial<Record<SlideKind, (c: ChatSlideContext) => SlideContent>> = {
  bullets: ({ topic, focus, audience, pick }) => ({
    kind: "bullets",
    title: t(`${focus}: what matters`),
    bullets: [
      b(`${capitalize(pick(0))} is the core of ${topic}`),
      b(`${capitalize(pick(1))} shapes how ${audience} will judge it`),
      b(`${capitalize(pick(2))} needs an owner and a deadline`),
      b(`Success looks like ${pick(3)} done well`),
    ],
    notes: clip(`Walk through each point on ${focus} and connect it back to ${topic}.`, LIMIT.notes),
  }),
  cards: ({ topic, audience, seed, pick }) => ({
    kind: "cards",
    title: t(`Three pillars of ${topic}`),
    cards: [0, 1, 2].map((n) => ({
      title: clip(capitalize(pick(n)), LIMIT.cardTitle),
      body: clip(`How ${pick(n)} moves ${topic} forward for ${audience}`, LIMIT.cardBody),
      icon: ICONS[(seed + n) % ICONS.length],
    })),
  }),
  stats: ({ topic, focus, seed, pick }) => {
    const pct = 25 + (seed % 60);
    const multiple = 2 + (seed % 4);
    const months = 3 + (seed % 9);
    return {
      kind: "stats",
      title: t(`${focus} in numbers`),
      body: clip(`Illustrative targets for ${topic}; replace with your measured figures.`, LIMIT.body),
      stats: [
        { value: `${pct}%`, label: clip(`Target improvement in ${pick(0)}`, LIMIT.statLabel) },
        { value: `${multiple}x`, label: clip(`Expected lift from ${pick(1)}`, LIMIT.statLabel) },
        { value: `${months} mo`, label: clip(`Time to deliver ${pick(2)}`, LIMIT.statLabel) },
      ],
    };
  },
  "image-text": ({ topic, audience, tone, pick }) => ({
    kind: "image-text",
    title: t(`Why ${pick(0)} matters now`),
    body: clip(`${capitalize(pick(0))} is where ${topic} either wins or stalls. This is the moment to set the standard for ${audience}.`, LIMIT.body),
    bullets: [b(`Today: ${pick(1)} is the bottleneck`), b(`Tomorrow: ${pick(2)} becomes the default`)],
    imageQuery: clip(`${topic} ${pick(0)} documentary photo, ${tone} mood`, LIMIT.imageQuery),
  }),
  process: ({ topic, audience, pick }) => ({
    kind: "process",
    title: t(`How we deliver ${topic}`),
    steps: [
      { title: clip(`Understand ${pick(0)}`, LIMIT.stepTitle), body: clip(`Map the current state of ${pick(0)} and agree on what good looks like.`, LIMIT.stepBody) },
      { title: clip(`Design ${pick(1)}`, LIMIT.stepTitle), body: clip(`Prototype ${pick(1)} with ${audience} in the loop.`, LIMIT.stepBody) },
      { title: clip(`Launch ${pick(2)}`, LIMIT.stepTitle), body: clip(`Roll out ${pick(2)} in stages and measure each one.`, LIMIT.stepBody) },
      { title: "Scale", body: clip(`Extend what worked across ${topic}.`, LIMIT.stepBody) },
    ],
  }),
  comparison: ({ topic, pick }) => ({
    kind: "comparison",
    title: t(`${topic}: before and after`),
    columnTitles: ["Today", "With this plan"],
    bullets: [b(`${capitalize(pick(0))} handled ad hoc`), b(`${capitalize(pick(1))} depends on a few people`), b(`Little visibility into ${pick(2)}`)],
    bulletsRight: [b(`${capitalize(pick(0))} runs on a clear process`), b(`${capitalize(pick(1))} is shared and documented`), b(`${capitalize(pick(2))} is measured every week`)],
  }),
  quote: ({ topic, pick }) => ({
    kind: "quote",
    title: t(`The case for ${pick(0)}`),
    quote: { text: clip(`If we get ${pick(0)} right, everything else in ${topic} gets easier.`, LIMIT.quoteText) },
  }),
  "two-column": ({ topic, focus, audience, pick }) => ({
    kind: "two-column",
    title: t(`${focus}: opportunities and risks`),
    columnTitles: ["Opportunities", "Risks"],
    bullets: [b(`Lead on ${pick(0)}`), b(`Turn ${pick(1)} into a strength`), b(`Win ${audience} early`)],
    bulletsRight: [b(`Underestimating ${pick(2)}`), b(`Moving on ${pick(3)} without data`), b(`Losing focus on ${topic}`)],
  }),
  section: ({ topic, focus }) => ({ kind: "section", title: t(focus), subtitle: clip(`The next part of ${topic}`, LIMIT.subtitle) }),
};

function chatSlide(kind: SlideKind, i: number, topic: string, phrases: string[], req: GenerateRequest): SlideContent {
  const pick = (n: number) => phrases[(i + n) % phrases.length] ?? topic;
  const ctx: ChatSlideContext = {
    topic,
    focus: capitalize(pick(0)),
    audience: req.audience?.trim() || "your audience",
    tone: req.tone,
    seed: hash(`${topic}:${i}`),
    pick,
  };
  const build = CHAT_SLIDES[kind];
  return build ? build(ctx) : { kind: "bullets", title: t(ctx.focus), bullets: [b(`${ctx.focus} in the context of ${topic}`)] };
}

function chatGeneration(req: GenerateRequest): Generation {
  const { topic, phrases: raw, audienceHint } = chatTopicAndPhrases(req.input);
  const phrases = raw.length ? raw : [topic];
  const audience = req.audience?.trim() || req.brief?.audience?.trim() || audienceHint;
  const target = Math.max(3, Math.min(20, req.slideCount));
  const company = req.brand?.company;

  const cover: SlideContent = {
    kind: "cover",
    title: clip(topic, LIMIT.title),
    subtitle: withCompany(company, audience ? `A ${req.tone} overview for ${audience}` : `A ${req.tone} overview`, LIMIT.subtitle),
    imageQuery: clip(`${topic} hero photo, ${req.tone} mood, wide shot`, LIMIT.imageQuery),
  };
  const closing: SlideContent = {
    kind: "closing",
    title: "Thank you",
    subtitle: withCompany(company, `Next step: agree on ${phrases[0] ?? topic}, then set a date`, LIMIT.subtitle),
    imageQuery: clip(`${topic} sunrise horizon, optimistic closing image`, LIMIT.imageQuery),
  };

  // Inline references use the head of the topic ("Expense tracking app" rather than
  // "Expense tracking app for small businesses") so sentences stay readable.
  const head = topic.replace(/\s+(?:for|aimed at|targeting|to|in|at)\s+.+$/i, "").trim();
  const shortTopic = head.length >= 6 ? head : topic;

  const middle: SlideContent[] = [];
  const middleCount = target - 2;
  // Sections only appear in longer decks, mirroring the generation guidance.
  const kinds = middleCount >= 8 ? CHAT_KINDS : CHAT_KINDS.filter((k) => k !== "section");
  for (let i = 0; i < middleCount; i++) {
    const kind = kinds[i % kinds.length];
    const slide = chatSlide(kind, i, shortTopic, phrases, { ...req, audience });
    // Use the brief's own phrases as slide titles when they add information.
    if (kind === "bullets" && raw[i % raw.length] && raw.length >= 3) {
      slide.title = clip(titleCase(capitalize(raw[i % raw.length])), LIMIT.title);
    }
    middle.push(slide);
  }

  return { title: clip(topic, LIMIT.deckTitle), slides: [cover, ...middle, closing] };
}

/* ------------------------------------------------------------------ */
/* Outline-driven generation                                           */
/* ------------------------------------------------------------------ */

type OutlineContext = { deckTitle: string; audience: string; tone: string; company?: string };

function columnTitlesFor(title: string, fallback: [string, string]): [string, string] {
  if (!VS_RE.test(title)) return fallback;
  const parts = title.split(VS_RE).map((p) => p.trim()).filter(Boolean);
  return parts.length >= 2 ? [clip(parts[0], LIMIT.columnTitle), clip(parts[1], LIMIT.columnTitle)] : fallback;
}

type OutlineSlideContext = OutlineContext & {
  title: string;
  /** Key points, or the goal when the item has none. */
  pts: string[];
  /** First half / second half of `pts` for two-column kinds. */
  left: string[];
  right: string[];
  lead: string;
  notes: string;
  seed: number;
};

const OUTLINE_SLIDES: Record<SlideKind, (c: OutlineSlideContext) => SlideContent> = {
  cover: ({ title, pts, notes, deckTitle, audience, tone, company }) => ({
    kind: "cover",
    title,
    subtitle: withCompany(company, pts[0] ?? `A ${tone} overview for ${audience}`, LIMIT.subtitle),
    imageQuery: clip(`${deckTitle} hero photo, ${tone} mood, wide shot`, LIMIT.imageQuery),
    notes,
  }),
  closing: ({ title, pts, notes, deckTitle, company }) => ({
    kind: "closing",
    title,
    subtitle: withCompany(company, pts[0] ?? `Next steps on ${deckTitle}`, LIMIT.subtitle),
    imageQuery: clip(`${deckTitle} horizon, calm closing image`, LIMIT.imageQuery),
    notes,
  }),
  section: ({ title, lead, notes }) => ({ kind: "section", title, subtitle: clip(lead, LIMIT.subtitle), notes }),
  bullets: ({ title, pts, notes }) => ({ kind: "bullets", title, bullets: pts.slice(0, 6).map(b), notes }),
  "two-column": ({ title, left, right, notes }) => ({
    kind: "two-column",
    title,
    columnTitles: columnTitlesFor(title, ["What we know", "What we will do"]),
    bullets: left.map(b),
    bulletsRight: right.map(b),
    notes,
  }),
  comparison: ({ title, left, right, notes }) => ({
    kind: "comparison",
    title,
    columnTitles: columnTitlesFor(title, ["Before", "After"]),
    bullets: left.map(b),
    bulletsRight: right.map(b),
    notes,
  }),
  cards: ({ title, pts, notes, seed, deckTitle, audience }) => ({
    kind: "cards",
    title,
    cards: pts.slice(0, 4).map((p, n) => {
      const { head, rest } = splitPair(p);
      return {
        title: clip(head || titleCase(p), LIMIT.cardTitle),
        body: clip(rest || `How ${p.toLowerCase()} moves ${deckTitle} forward for ${audience}`, LIMIT.cardBody),
        icon: ICONS[(seed + n) % ICONS.length],
      };
    }),
    notes,
  }),
  stats: ({ title, pts, notes, seed, deckTitle }) => {
    let illustrative = false;
    const stats = pts.slice(0, 4).map((p, n) => {
      const m = STAT_RE.exec(p);
      if (m) {
        const label = p.replace(m[0], "").replace(/^[\s:—–\-,.]+|[\s:—–\-,.]+$/g, "").trim();
        return { value: clip(m[0].replace(/\s+/g, ""), LIMIT.statValue), label: clip(label || title, LIMIT.statLabel) };
      }
      illustrative = true;
      return { value: `${25 + ((seed + n * 17) % 60)}%`, label: clip(p, LIMIT.statLabel) };
    });
    const content: SlideContent = { kind: "stats", title, stats, notes };
    if (illustrative) content.body = clip(`Illustrative targets for ${deckTitle}; replace with your measured figures.`, LIMIT.body);
    return content;
  },
  quote: ({ title, lead, notes }) => {
    const m = QUOTE_RE.exec(lead);
    const text = clip(m?.[1] ?? lead, LIMIT.quoteText);
    return { kind: "quote", title, quote: m?.[2] ? { text, by: clip(m[2], LIMIT.quoteBy) } : { text }, notes };
  },
  "image-text": ({ title, pts, lead, notes, deckTitle, tone }) => ({
    kind: "image-text",
    title,
    bullets: pts.slice(0, 4).map(b),
    imageQuery: clip(`${deckTitle} ${lead} documentary photo, ${tone} mood`, LIMIT.imageQuery),
    notes,
  }),
  process: ({ title, pts, notes }) => ({
    kind: "process",
    title,
    steps: pts.slice(0, 6).map((p, n) => {
      const { head, rest } = splitPair(p);
      return { title: clip(head || `Step ${n + 1}`, LIMIT.stepTitle), body: clip(rest || p, LIMIT.stepBody) };
    }),
    notes,
  }),
};

/** One SlideContent for an outline item: the item's kind and title, with the body fields derived from its key points. */
function contentFromOutlineItem(item: OutlineItem, index: number, ctx: OutlineContext): SlideContent {
  const goal = item.goal.replace(/\s+/g, " ").trim();
  const points = (item.keyPoints ?? []).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
  const pts = points.length ? points : [goal];
  const half = Math.ceil(pts.length / 2);
  return OUTLINE_SLIDES[item.kind]({
    ...ctx,
    title: clip(item.title, LIMIT.title),
    pts,
    left: pts.slice(0, half),
    right: pts.length > 1 ? pts.slice(half) : [`What ${pts[0].toLowerCase()} means for ${ctx.audience}`],
    lead: pts[0],
    notes: clip(`Goal of this slide: ${goal}`, LIMIT.notes),
    seed: hash(`${ctx.deckTitle}:${index}:${item.title}`),
  });
}

function outlineGeneration(req: GenerateRequest, outline: Outline): Generation {
  const deckTitle = clip(outline.title, LIMIT.deckTitle);
  const ctx: OutlineContext = {
    deckTitle,
    audience: req.audience?.trim() || req.brief?.audience?.trim() || outline.audience?.trim() || "your audience",
    tone: req.tone,
    company: req.brand?.company,
  };
  return { title: deckTitle, slides: outline.slides.map((item, i) => contentFromOutlineItem(item, i, ctx)) };
}

/* ------------------------------------------------------------------ */
/* Public generate                                                     */
/* ------------------------------------------------------------------ */

export function mockGenerate(req: GenerateRequest): Generation {
  if (req.outline) return outlineGeneration(req, req.outline);
  return req.mode === "paste" ? pasteGeneration(req) : chatGeneration(req);
}

/* ------------------------------------------------------------------ */
/* Intake suggestions                                                  */
/* ------------------------------------------------------------------ */

/** The topic as the brief knows it, or as best derived from the conversation. */
function knownTopic(brief: Brief, history: SuggestRequest["history"]): string | undefined {
  const fromBrief = brief.topic?.trim();
  if (fromBrief) return clip(fromBrief.replace(/[.!?]+$/, ""), 60);
  const lastUser = [...history].reverse().find((t) => t.role === "user")?.content.trim();
  if (lastUser) {
    const { topic } = chatTopicAndPhrases(lastUser);
    if (topic !== "Your presentation") return topic;
  }
  if (brief.source?.trim()) return clip(parseSource(brief.source).deckTitle, 60);
  return undefined;
}

function uniqueSuggestions(items: string[], exclude: string[]): string[] {
  const seen = new Set(exclude.map(norm));
  const out: string[] = [];
  for (const raw of items) {
    const item = clip(raw, LIMIT.suggestion);
    const key = norm(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function mockSuggest(req: SuggestRequest): SuggestResponse {
  const brief = req.brief;
  // Topic is kept as the user wrote it (proper nouns keep their case).
  const topic = knownTopic(brief, req.history);
  const t = topic;
  const audience = brief.audience?.trim();
  const already = [brief.topic, brief.audience, brief.goal, brief.angle, ...(brief.mustInclude ?? [])].filter((v): v is string => Boolean(v?.trim()));
  const lower = `${topic ?? ""} ${audience ?? ""} ${brief.goal ?? ""}`.toLowerCase();

  let items: string[];
  let hint: string;
  switch (req.stage) {
    case "topic":
      items = t
        ? [`Investor pitch for ${t}`, `Client proposal: ${t}`, `Product launch: ${t}`, `Quarterly business review on ${t}`, `Training / onboarding deck on ${t}`]
        : ["Investor pitch for our product", "Client proposal", "Product launch", "Quarterly business review", "Training / onboarding deck"];
      hint = "Name the deck type and the subject in one line; the rest of the brief builds on it.";
      break;
    case "audience": {
      const base = ["Executive leadership", "Prospective clients", "Investors", "Internal team", "Conference audience"];
      const lead = /investor|pitch|fundrais/.test(lower) ? "Investors" : /training|onboarding|new hire/.test(lower) ? "New hires" : /proposal|client|sales|customer/.test(lower) ? "Prospective clients" : /review|qbr|quarter|board/.test(lower) ? "Executive leadership" : undefined;
      items = lead ? [lead, ...base.filter((x) => x !== lead)] : base;
      hint = t ? `Pick who actually decides on ${t}; the copy is written for them.` : "Pick who actually decides; the copy is written for them.";
      break;
    }
    case "goal":
      items = ["Win approval for the budget", "Close the deal", "Align the team on the plan", "Educate and build trust"];
      if (audience) items.push(`Get ${lowerFirst(audience)} to agree on next steps`);
      hint = "Phrase the goal as the outcome you want after the last slide.";
      break;
    case "mustInclude": {
      const phrases = t ? chatTopicAndPhrases(topic ?? "").phrases.filter((p) => p.length >= 4 && p.toLowerCase() !== t.toLowerCase()) : [];
      const topical = phrases.slice(0, 2).map((p) => `Why ${lowerFirst(p)} matters`);
      items = [...topical, "Results and proof", "Timeline and next steps", "Pricing / investment", "Team and credentials"];
      hint = "Add one point per answer; each becomes its own slide or a named key point.";
      break;
    }
    case "angle":
      items = ["Problem → solution → proof", "Before and after", "Vision-led story", "Data-first"];
      hint = /investor|pitch|proposal|deal|approval|budget/.test(lower)
        ? "Problem → solution → proof is the safest angle when you are asking for a decision."
        : "Vision-led works for launches and updates; data-first when you have real numbers.";
      break;
    case "confirm": {
      const hasPricing = (brief.mustInclude ?? []).some((m) => /pric|cost|invest|budget/i.test(m));
      items = ["Looks right, build the outline", "Make it shorter (6–8 slides)", "Add a competitor comparison", hasPricing ? "Add a customer story" : "Add a pricing slide"];
      hint = "Confirm to get an outline you can still edit before the slides are written.";
      break;
    }
  }

  let suggestions = uniqueSuggestions(items, already).slice(0, 6);
  if (suggestions.length < 3) suggestions = uniqueSuggestions([...items, "Something more specific to my situation", "Keep it simple"], []).slice(0, 6);
  return { suggestions, hint: clip(hint, LIMIT.hint) };
}

/* ------------------------------------------------------------------ */
/* Outline                                                             */
/* ------------------------------------------------------------------ */

function keyPoint(s: string): string {
  return clip(s.replace(/[.!?]+$/, ""), LIMIT.keyPoint);
}

/** Two to four key points: the real points first, fallbacks only to reach the minimum of two. */
function keyPoints(points: string[], fallbacks: string[]): string[] {
  const out: string[] = [];
  const add = (p: string) => {
    const kp = keyPoint(p);
    if (kp && !out.some((o) => norm(o) === norm(kp))) out.push(kp);
  };
  for (const p of points) {
    if (out.length >= 4) break;
    add(p);
  }
  for (const p of fallbacks) {
    if (out.length >= 2) break;
    add(p);
  }
  return out;
}

function outlineItem(kind: SlideKind, title: string, goal: string, points: string[], fallbacks: string[] = []): OutlineItem {
  return {
    title: clip(title, LIMIT.outlineTitle),
    kind,
    goal: clip(goal, LIMIT.outlineGoal),
    keyPoints: keyPoints(points, fallbacks),
  };
}

/** Key points read back from generated slide content (used when outlining pasted material). */
function keyPointsFromContent(c: SlideContent): string[] {
  const fromShape =
    c.bullets ??
    c.steps?.map((st) => (st.body ? `${st.title}: ${st.body}` : st.title)) ??
    c.cards?.map((cd) => `${cd.title}: ${cd.body}`) ??
    c.stats?.map((st) => `${st.value} ${st.label}`) ??
    (c.quote ? [c.quote.by ? `"${c.quote.text}" — ${c.quote.by}` : c.quote.text] : undefined) ??
    (c.body ? sentences(c.body) : []);
  const right = c.bulletsRight ?? [];
  return [...fromShape, ...right].filter(Boolean);
}

function pasteOutline(req: OutlineRequest, target: number): Outline {
  const source = parseSource(req.brief.source ?? "");
  const middle = pasteMiddle(source, target - 2);
  const items: OutlineItem[] = middle.map((c) =>
    outlineItem(c.kind, c.title, `Present "${c.title}" as the source states it`, keyPointsFromContent(c), [c.subtitle ?? "", `Why ${lowerFirst(c.title)} matters`]),
  );
  // Pad to the requested count with discussion slides on the source's sections.
  const cycle = middle.filter((c) => c.title !== "Agenda" && c.title !== "Key takeaways");
  for (let i = 0; items.length < target - 2 && cycle.length; i++) {
    const c = cycle[i % cycle.length];
    items.push(outlineItem("two-column", `Discussion: ${c.title}`, `Open the floor on ${c.title}`, [`Questions on ${lowerFirst(c.title)}`, `Decisions needed on ${lowerFirst(c.title)}`]));
  }
  const audience = req.brief.audience?.trim();
  const cover = outlineItem("cover", source.deckTitle, `Open with the promise of ${source.deckTitle}`, [source.coverSubtitle ?? "", audience ? `Prepared for ${audience}` : `${cycle.length} topics from the source`]);
  const closing = outlineItem("closing", "Thank you", `Close with the ask and next steps on ${source.deckTitle}`, [req.brief.goal ?? `Questions and next steps on ${source.deckTitle}`, "Agree owners and a date"]);
  const outline: Outline = { title: source.deckTitle, tone: clip(req.tone, 40), slides: [cover, ...items, closing] };
  if (audience) outline.audience = clip(audience, 80);
  return outline;
}

function chatOutline(req: OutlineRequest, target: number): Outline {
  const brief = req.brief;
  const rawTopic = brief.topic?.trim() || brief.angle?.trim() || "Your presentation";
  const { topic: parsedTopic, phrases: topicPhrases, audienceHint } = chatTopicAndPhrases(rawTopic);
  const topic = clip(capitalize(parsedTopic), LIMIT.outlineTitle);
  const head = topic.replace(/\s+(?:for|aimed at|targeting|to|in|at)\s+.+$/i, "").trim();
  const short = head.length >= 6 ? head : topic;
  const audience = brief.audience?.trim() || audienceHint || "your audience";
  const goal = brief.goal?.trim() || `agree on the next step for ${short}`;
  const must = (brief.mustInclude ?? []).map((m) => m.replace(/\s+/g, " ").trim()).filter(Boolean);
  const phrases = [...must, ...topicPhrases].filter((p, i, arr) => arr.findIndex((q) => norm(q) === norm(p)) === i);
  const pick = (n: number) => phrases[n % phrases.length] ?? short;
  const middleBudget = target - 2;

  const beats: OutlineItem[] = [
    outlineItem("image-text", `Why ${short} matters now`, `Set the scene for ${audience}`, [`Where ${audience} stand today`, `What changes if ${short} succeeds`, "Why now"]),
    outlineItem("bullets", "The problem we are solving", `Make the pain concrete before the solution`, [`${capitalize(pick(0))} is the bottleneck`, `Cost of doing nothing for ${audience}`, `What ${audience} have told us`]),
    outlineItem("cards", `How ${short} works`, `Explain the solution in three parallel pillars`, [capitalize(pick(0)), capitalize(pick(1)), capitalize(pick(2))]),
    outlineItem("stats", `${short} in numbers`, `Back the story with figures or clearly labelled targets`, [`Target improvement in ${pick(0)}`, `Expected lift from ${pick(1)}`, `Time to deliver ${pick(2)}`]),
    outlineItem("process", `The plan: from today to done`, `Show the path and who does what`, [`Understand ${pick(0)}`, `Design ${pick(1)}`, `Launch ${pick(2)}`, "Scale what worked"]),
    outlineItem("comparison", `${short}: before and after`, `Contrast today with the proposed state`, [`Today: ${pick(0)} handled ad hoc`, `After: ${pick(0)} runs on a clear process`, `Today: little visibility into ${pick(1)}`, `After: ${pick(1)} measured weekly`]),
    outlineItem("quote", `What this means for ${audience}`, `One memorable line the audience repeats afterwards`, [`If we get ${pick(0)} right, everything else in ${short} gets easier`], [`Attribute it to the team or a customer voice`]),
    outlineItem("two-column", "Opportunities and risks", `Show you have weighed both sides`, [`Lead on ${pick(0)}`, `Turn ${pick(1)} into a strength`, `Risk: underestimating ${pick(2)}`, `Risk: moving on ${pick(3)} without data`]),
    outlineItem("bullets", "The ask", `Land the goal: ${goal}`, [capitalize(goal), "Decision needed today", "What happens next week"]),
  ];
  if (middleBudget >= 8) beats.splice(4, 0, outlineItem("section", "The plan", `Divide the story before the delivery plan`, [`How ${short} gets delivered`, "Timeline, owners and milestones"]));

  const mustSlides = must.map((m) =>
    outlineItem("bullets", titleCase(capitalize(m)), `Cover "${m}" as requested in the brief`, [`What ${lowerFirst(m)} is and why it matters here`, `Where ${lowerFirst(m)} stands today`, `What we will do about ${lowerFirst(m)} next`]),
  );

  // Must-include slides sit after context and problem; story beats are dropped from the end when over budget.
  const ordered = [...beats.slice(0, 2), ...mustSlides, ...beats.slice(2)];
  const mustSet = new Set(mustSlides);
  const middle: OutlineItem[] = [...ordered];
  for (let i = middle.length - 1; middle.length > middleBudget && i >= 0; i--) {
    if (!mustSet.has(middle[i])) middle.splice(i, 1);
  }
  const trimmed = middle.slice(0, middleBudget);
  for (let i = 0; trimmed.length < middleBudget; i++) {
    const p = pick(i);
    trimmed.push(outlineItem("bullets", `Deep dive: ${titleCase(capitalize(p))}`, `Give ${p} the detail ${audience} will ask for`, [`How ${p} works in practice`, `What it takes to deliver ${p}`, `How we will measure ${p}`]));
  }

  const cover = outlineItem("cover", topic, `Open with the promise of ${short} for ${audience}`, [`Prepared for ${audience}`, `Why ${short} matters now`]);
  const closing = outlineItem("closing", "Thank you", `Close with the ask: ${goal}`, [capitalize(goal), "Next steps and timeline"]);
  const outline: Outline = { title: topic, tone: clip(req.tone, 40), slides: [cover, ...trimmed, closing] };
  if (brief.audience?.trim()) outline.audience = clip(brief.audience.trim(), 80);
  return outline;
}

export function mockOutline(req: OutlineRequest): Outline {
  const target = Math.max(3, Math.min(20, req.slideCount));
  return req.mode === "paste" && req.brief.source?.trim() ? pasteOutline(req, target) : chatOutline(req, target);
}

/* ------------------------------------------------------------------ */
/* Revise                                                              */
/* ------------------------------------------------------------------ */

const THEME_NAMES: Record<ThemeId, string> = {
  "glass-contrast": "Glass Contrast",
  "cobalt-stripes": "Cobalt Stripes",
  "sky-facet": "Sky Facet",
  midnight: "Midnight",
  paper: "Paper",
  "aurora-night": "Aurora Night",
  "brutalist-mono": "Brutalist Mono",
  "editorial-ivory": "Editorial Ivory",
  "forest-calm": "Forest Calm",
  "glass-frost": "Glass Frost",
  "luxe-noir": "Luxe Noir",
  "neon-grid": "Neon Grid",
  "pop-blocks": "Pop Blocks",
  "sunset-retro": "Sunset Retro",
  "swiss-minimal": "Swiss Minimal",
};

const UNMAPPED = "I could not map that request in offline mode.";

function matchTheme(instruction: string): ThemeId | undefined {
  const text = ` ${norm(instruction)} `;
  for (const id of ThemeIdSchema.options) {
    const candidates = [norm(id), norm(THEME_NAMES[id])];
    if (candidates.some((c) => text.includes(` ${c} `))) return id;
  }
  return undefined;
}

function shorten(content: SlideContent): SlideContent {
  const out: SlideContent = { ...content };
  if (out.subtitle) out.subtitle = clip(out.subtitle, 80);
  if (out.body) out.body = clip(sentences(out.body)[0] ?? out.body, 160);
  if (out.bullets) out.bullets = out.bullets.slice(0, 3).map((b) => clip(b, 60));
  if (out.bulletsRight) out.bulletsRight = out.bulletsRight.slice(0, 3).map((b) => clip(b, 60));
  if (out.cards) out.cards = out.cards.map((c) => ({ ...c, body: clip(c.body, 70) }));
  if (out.steps) out.steps = out.steps.map((s) => ({ ...s, body: clip(s.body, 60) }));
  if (out.stats) out.stats = out.stats.map((s) => ({ ...s, label: clip(s.label, 30) }));
  if (out.quote) out.quote = { ...out.quote, text: clip(out.quote.text, 120) };
  return out;
}

function lengthen(content: SlideContent): SlideContent {
  const out: SlideContent = { ...content };
  const topic = out.title.replace(/[.!?:]+$/, "");
  const extra = clip(`What this means in practice for ${topic}`, LIMIT.bullet);
  if (out.bullets) {
    if (out.bullets.length < 6) out.bullets = [...out.bullets, extra];
    else out.body = clip(`${out.body ? `${out.body} ` : ""}${extra}.`, LIMIT.body);
  } else if (out.steps) {
    if (out.steps.length < 6) out.steps = [...out.steps, { title: "Review", body: clip(`Check results against the goal of ${topic}.`, LIMIT.stepBody) }];
  } else if (out.cards) {
    if (out.cards.length < 4) out.cards = [...out.cards, { title: "Next step", body: clip(`How ${topic} moves forward from here.`, LIMIT.cardBody) }];
  } else if (["bullets", "two-column", "image-text", "section", "comparison"].includes(out.kind) || !out.body) {
    out.bullets = [extra];
  } else {
    out.body = clip(`${out.body} ${extra}.`, LIMIT.body);
  }
  return out;
}

function aboutSlide(subject: string): SlideContent {
  const s = subject.replace(/[.!?]+$/, "").trim();
  const heading = clip(titleCase(capitalize(s)), LIMIT.title);
  return {
    kind: "bullets",
    title: heading,
    bullets: [
      clip(`What ${s} is and why it matters here`, LIMIT.bullet),
      clip(`Where ${s} stands today`, LIMIT.bullet),
      clip(`What we will do about ${s} next`, LIMIT.bullet),
      clip(`How we will know ${s} is working`, LIMIT.bullet),
    ],
    notes: clip(`Added on request: a slide about ${s}. Refine the bullets with specifics.`, LIMIT.notes),
  };
}

function parseSlideNumber(instruction: string): number | undefined {
  const m = /\bslide\s*(?:#|number\s*)?(\d{1,2})\b/i.exec(instruction);
  if (!m) return undefined;
  return Number(m[1]) - 1;
}

/* ------------------------------------------------------------------ */
/* Revise: element scope                                               */
/* ------------------------------------------------------------------ */

/** Colour names the offline reviser understands, mapped to hex. */
export const COLOR_NAMES: Record<string, string> = {
  red: "#E5484D",
  blue: "#1B5FD9",
  green: "#2E9E5B",
  orange: "#F28C28",
  yellow: "#F5C518",
  purple: "#7C3AED",
  pink: "#EC4899",
  teal: "#14B8A6",
  black: "#000000",
  white: "#FFFFFF",
  grey: "#808080",
  gray: "#808080",
  coral: "#F05A3C",
  navy: "#0B1F4B",
};

/** Font size step for "bigger" / "smaller", in stage pixels. */
export const FONT_STEP = 4;
const MIN_FONT_SIZE = 8;
/** Scale factors for "bigger" / "smaller" on non-text elements. */
const GROW = 1.25;
const SHRINK = 0.8;

const TITLE_ROLES: ReadonlySet<TextRole> = new Set<TextRole>(["title", "heading", "label", "number"]);
const CLAUSE_RE = /,\s+|;\s+|\s+[—–-]\s+|:\s+/;
const CLAUSE_G_RE = /,\s+|;\s+|\s+[—–-]\s+|:\s+/g;
/** Connectives that introduce a cause, condition or means; a sentence can be turned around at the first one. */
const PIVOT_RE = /\s+(after|because|thanks to|on the back of|driven by|due to|through|with|when|while|since|so that|which)\s+/i;
const HEDGE_RE = /\b(?:very|really|quite|just|basically|actually|simply|somewhat|rather|truly|literally|kind of|sort of)\s+/gi;
const TEXT_LIMIT: Record<TextRole, number> = {
  title: 90,
  subtitle: 160,
  heading: 90,
  body: 400,
  bullets: 110,
  caption: 120,
  quote: 220,
  number: 14,
  label: 40,
};
const IMAGE_STYLES = [
  "editorial photo, natural light",
  "abstract illustration, soft gradients",
  "close-up detail, shallow depth of field",
  "wide cinematic scene, muted palette",
  "minimal flat lay on paper",
  "people at work, candid, warm tones",
];

/* ----- text helpers ----- */

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

type HtmlShape = "list" | "paragraphs" | "plain";

function htmlShape(html: string): HtmlShape {
  if (/<(?:ul|ol)\b/i.test(html)) return "list";
  if (/<(?:p|div|h[1-6]|br)\b/i.test(html)) return "paragraphs";
  return "plain";
}

function linesOf(html: string): string[] {
  return htmlToText(html).split("\n").filter(Boolean);
}

function toHtml(lines: string[], shape: HtmlShape): string {
  if (shape === "list") return `<ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`;
  if (shape === "paragraphs" || lines.length > 1) return lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("");
  return escapeHtml(lines[0] ?? "");
}

/** Rebuild the element's HTML from its plain lines, keeping list / paragraph / plain shape. */
function mapLines(html: string, fn: (line: string, index: number, all: string[]) => string): string {
  const shape = htmlShape(html);
  const lines = linesOf(html);
  return toHtml(lines.map(fn).map((l) => l.trim()).filter(Boolean), shape);
}

function terminal(line: string): string {
  return /[.!?]$/.exec(line)?.[0] ?? "";
}

function withoutTerminal(line: string): string {
  return line.replace(/[.!?]+$/, "").trimEnd();
}

function tighten(line: string): string {
  return line
    .replace(HEDGE_RE, "")
    .replace(/\bin order to\b/gi, "to")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

/** Keep roughly the first half: whole sentences, else up to the clause boundary nearest the middle, else half the words. */
function halveLine(line: string): string {
  const parts = sentences(line);
  if (parts.length > 1) return parts.slice(0, Math.ceil(parts.length / 2)).join(" ");
  const end = terminal(line);
  const mid = line.length / 2;
  let best: number | undefined;
  for (const m of line.matchAll(CLAUSE_G_RE)) {
    if (m.index < 8) continue;
    if (best === undefined || Math.abs(m.index - mid) < Math.abs(best - mid)) best = m.index;
  }
  if (best !== undefined) return `${line.slice(0, best).trimEnd()}${end}`;
  const words = line.split(" ");
  if (words.length < 6) return line;
  const kept = words.slice(0, Math.ceil(words.length / 2));
  while (kept.length > 2 && STOP_WORDS.has(kept[kept.length - 1].toLowerCase().replace(/[^a-z]/g, ""))) kept.pop();
  return `${kept.join(" ").replace(/[,;:]$/, "")}${end}`;
}

function lengthenLine(line: string, topic: string, titleLike: boolean): string {
  const end = terminal(line);
  const base = withoutTerminal(line);
  if (titleLike) return `${base}: what it means for ${topic}`;
  return `${base}, which matters for ${topic}${end || "."}`;
}

/** Turn "X after Y" into "After Y, x"; otherwise drop hedges and re-case. */
function rewriteLine(line: string, titleLike: boolean): string {
  const s = tighten(line);
  const end = titleLike ? "" : terminal(s) || ".";
  const body = withoutTerminal(s);
  const pivot = PIVOT_RE.exec(body);
  if (pivot && pivot.index > 0) {
    const head = body.slice(0, pivot.index).trim();
    const tail = body.slice(pivot.index + pivot[0].length).trim();
    const split = CLAUSE_RE.exec(tail);
    const tailFirst = split ? tail.slice(0, split.index).trim() : tail;
    const tailRest = split ? tail.slice(split.index + split[0].length).trim() : "";
    if (head && tailFirst) {
      return `${capitalize(`${pivot[1].toLowerCase()} ${tailFirst}`)}, ${lowerFirst(head)}${tailRest ? `, ${tailRest}` : ""}${end}`;
    }
  }
  const clauses = body.split(CLAUSE_RE).map((c) => c.trim()).filter(Boolean);
  if (clauses.length > 1) {
    const last = clauses[clauses.length - 1].replace(/^(?:and|but|so|yet)\s+/i, "");
    const rest = clauses.slice(0, -1).join(", ");
    return `${capitalize(last)}: ${lowerFirst(rest)}${end}`;
  }
  return titleLike ? titleCase(capitalize(body)) : `${capitalize(body)}${end}`;
}

/** Keep the leading clause, drop hedges and end hard. */
function punchLine(line: string, titleLike: boolean): string {
  const s = tighten(line);
  const end = titleLike ? "" : terminal(s) || ".";
  const body = withoutTerminal(s).replace(/^(?:the|our|a|an|so|and|but)\s+/i, "");
  const pivot = PIVOT_RE.exec(body);
  let core = pivot && pivot.index > 0 ? body.slice(0, pivot.index) : body;
  const clauses = core.split(CLAUSE_RE).map((c) => c.trim()).filter(Boolean);
  core = clauses[0] ?? core;
  if (clauses.length > 1 && core.split(" ").length < 3) core = `${core}: ${clauses[1]}`;
  return `${capitalize(core.trim())}${end}`;
}

function fixGrammarLine(line: string, titleLike: boolean): string {
  let s = line
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/,(?=[A-Za-z])/g, ", ")
    .replace(/\bi\b/g, "I")
    .replace(/\s*\.{2,}$/, ".")
    .replace(/([!?]){2,}$/, "$1");
  s = s.replace(/(^|[.!?]\s+)([a-z])/g, (_m, p: string, c: string) => `${p}${c.toUpperCase()}`);
  if (titleLike) return s.replace(/\.+$/, "");
  if (!/[.!?:…"”’)]$/.test(s)) s += ".";
  return s;
}

function parseColor(instruction: string): { hex: string; name: string } | undefined {
  const hex = /#([0-9a-f]{6}|[0-9a-f]{3})\b/i.exec(instruction);
  if (hex) {
    const raw = hex[1];
    const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
    const value = `#${full.toUpperCase()}`;
    return { hex: value, name: value };
  }
  const text = ` ${norm(instruction)} `;
  for (const [name, value] of Object.entries(COLOR_NAMES)) {
    if (text.includes(` ${name} `)) return { hex: value, name };
  }
  return undefined;
}

function parseLanguage(instruction: string): string | undefined {
  const m = /\btranslat\w*\b[^.!?]*?\b(?:to|into|in)\s+([A-Za-z][A-Za-z-]*(?:\s+[A-Z][A-Za-z-]+)?)/.exec(instruction);
  if (!m) return undefined;
  const lang = m[1].trim();
  return lang ? capitalize(lang) : undefined;
}

function parseAlign(lower: string): "left" | "center" | "right" | undefined {
  if (/\b(?:centre|center|centred|centered)\b/.test(lower)) return "center";
  const aligned = /\b(?:align|justify|flush|to the)\b/.test(lower);
  if (aligned && /\bleft\b/.test(lower)) return "left";
  if (aligned && /\bright\b/.test(lower)) return "right";
  if (/\b(?:left|right)[- ]align/.test(lower)) return /\bleft/.test(lower) ? "left" : "right";
  return undefined;
}

function freshImageQuery(slideTitle: string, current: string | undefined): string {
  const style = IMAGE_STYLES[(hash(current ?? "") + 1) % IMAGE_STYLES.length];
  const topic = slideTitle.replace(/[.!?:]+$/, "").trim() || "the topic";
  return clip(`${topic}, ${style}`, LIMIT.imageQuery);
}

/* ----- intent detection ----- */

type Intent =
  | { kind: "delete" }
  | { kind: "duplicate" }
  | { kind: "translate"; language: string }
  | { kind: "shorter" }
  | { kind: "longer" }
  | { kind: "punchier" }
  | { kind: "rewrite" }
  | { kind: "grammar" }
  | { kind: "bigger" }
  | { kind: "smaller" }
  | { kind: "color"; hex: string; name: string }
  | { kind: "align"; align: "left" | "center" | "right" }
  | { kind: "describeImage"; query: string }
  | { kind: "newImage" };

function detectIntent(instruction: string, lower: string): Intent | undefined {
  const mentionsSlide = /\bslide\b/.test(lower);
  if (!mentionsSlide && /\b(?:delete|remove|drop|get rid of)\b/.test(lower)) return { kind: "delete" };
  if (!mentionsSlide && /\b(?:duplicate|copy|clone)\b/.test(lower)) return { kind: "duplicate" };
  const language = parseLanguage(instruction);
  if (language) return { kind: "translate", language };
  const describe = /\bdescribe\s+(?:it|this|the (?:image|picture|photo))?\s*as\s+(.+)$/i.exec(instruction);
  if (describe) return { kind: "describeImage", query: describe[1].trim().replace(/[.!?]+$/, "") };
  if (/\b(?:image|picture|photo|visual|illustration)\s+idea\b/.test(lower) || (/\b(?:new|another|different|fresh|other|regenerate|reimagine|change|replace)\b/.test(lower) && /\b(?:image|picture|photo|visual|illustration|idea)\b/.test(lower))) {
    return { kind: "newImage" };
  }
  const color = /\bcolou?r\b/.test(lower) || /\b(?:make|turn|paint)\s+(?:it|this|them|the \w+)\s+(?:#[0-9a-f]{3,6}|[a-z]+)\b/.test(lower) ? parseColor(instruction) : undefined;
  if (color) return { kind: "color", ...color };
  if (/\b(?:fix|correct|check)\b.*\b(?:grammar|spelling|typos?|punctuation)\b|\b(?:grammar|spelling|typos?)\b/.test(lower)) return { kind: "grammar" };
  if (/\b(?:shorter|shorten|concise|tighter|tighten|trim|condense|fewer words|less text|cut it down)\b/.test(lower)) return { kind: "shorter" };
  if (/\b(?:longer|lengthen|expand|elaborate|more detail|more details|add detail|flesh out|more depth)\b/.test(lower)) return { kind: "longer" };
  if (/\b(?:punchier|punchy|snappier|snappy|bolder|stronger|more impact|catchier)\b/.test(lower)) return { kind: "punchier" };
  if (/\b(?:rewrite|reword|rephrase|reframe|improve|polish|better wording)\b/.test(lower)) return { kind: "rewrite" };
  if (/\b(?:bigger|larger|increase|enlarge|bump up|size up|scale up)\b/.test(lower)) return { kind: "bigger" };
  if (/\b(?:smaller|decrease|reduce|shrink|size down|scale down)\b/.test(lower)) return { kind: "smaller" };
  const align = parseAlign(lower);
  if (align) return { kind: "align", align };
  return undefined;
}

/* ----- per-type revisers ----- */

type ElementScope = {
  slideIndex: number;
  elementId: string;
  type: ElementType;
  element: Element | undefined;
  selection: ReviseSelection;
  slideTitle: string;
  deckTitle: string;
};

/** Subject used when appending a clause: the slide title, or the deck title when the line is the slide title itself. */
function topicFor(scope: ElementScope, line: string, titleLike: boolean): string {
  const clean = (t: string) => lowerFirst(t.replace(/[.!?:]+$/, "").trim());
  const slide = clean(scope.slideTitle);
  const deck = clean(scope.deckTitle);
  if (!titleLike && slide && slide !== clean(line)) return slide;
  if (deck && deck !== clean(line)) return deck;
  return "your audience";
}

function describeElement(scope: ElementScope): string {
  const at = `on slide ${scope.slideIndex + 1}`;
  const el = scope.element;
  if (scope.type === "text") {
    const role = el?.type === "text" ? el.role : scope.selection.role;
    return `the ${role ?? "text"} ${at}`;
  }
  if (scope.type === "card") {
    const title = el?.type === "card" ? el.title : undefined;
    return title ? `the card "${clip(title, 30)}" ${at}` : `the card ${at}`;
  }
  return `the ${scope.type} ${at}`;
}

function scaledBox(scope: ElementScope, factor: number): PatchOp | undefined {
  const el = scope.element;
  if (!el) return undefined;
  return { op: "setElementBox", slideIndex: scope.slideIndex, elementId: scope.elementId, w: Math.round(el.w * factor), h: Math.round(el.h * factor) };
}

function reviseText(scope: ElementScope, intent: Intent, summary: (s: string) => string): Revision | undefined {
  const { slideIndex, elementId } = scope;
  const el = scope.element?.type === "text" ? scope.element : undefined;
  const role: TextRole = el?.role ?? scope.selection.role ?? "body";
  const titleLike = TITLE_ROLES.has(role);
  const html = el?.html ?? scope.selection.text ?? "";
  const what = describeElement(scope);
  const limit = TEXT_LIMIT[role];
  const textOp = (nextHtml: string): PatchOp => ({ op: "setElementText", slideIndex, elementId, html: nextHtml });
  const styleOp = (style: Extract<PatchOp, { op: "setElementStyle" }>["style"]): PatchOp => ({ op: "setElementStyle", slideIndex, elementId, style });
  const hasText = linesOf(html).length > 0;

  switch (intent.kind) {
    case "shorter": {
      if (!hasText) return { summary: summary(`There is no text to shorten in ${what}.`), ops: [] };
      const next = mapLines(html, halveLine);
      if (next === html) return { summary: summary(`${capitalize(what)} is already short; no change made.`), ops: [] };
      return { summary: summary(`Shortened ${what}.`), ops: [textOp(next)] };
    }
    case "longer": {
      if (!hasText) return { summary: summary(`There is no text to expand in ${what}.`), ops: [] };
      const shape = htmlShape(html);
      const lines = linesOf(html);
      let next: string;
      if (shape === "list" && lines.length < 6) {
        next = toHtml([...lines, clip(`What this means in practice for ${topicFor(scope, "", false)}`, limit)], shape);
      } else {
        next = mapLines(html, (line, i, all) => (i === all.length - 1 ? clip(lengthenLine(line, topicFor(scope, line, titleLike), titleLike), limit) : line));
      }
      return { summary: summary(`Expanded ${what} with an extra point.`), ops: [textOp(next)] };
    }
    case "rewrite":
    case "punchier": {
      if (!hasText) return { summary: summary(`There is no text to rewrite in ${what}.`), ops: [] };
      const fn = intent.kind === "punchier" ? punchLine : rewriteLine;
      const next = mapLines(html, (line) => clip(fn(line, titleLike), limit));
      if (next === html) return { summary: summary(`${capitalize(what)} is already tight; no change made.`), ops: [] };
      return { summary: summary(`${intent.kind === "punchier" ? "Made" : "Rewrote"} ${what}${intent.kind === "punchier" ? " punchier" : ""}.`), ops: [textOp(next)] };
    }
    case "grammar": {
      if (!hasText) return { summary: summary(`There is no text to check in ${what}.`), ops: [] };
      const next = mapLines(html, (line) => fixGrammarLine(line, titleLike || htmlShape(html) === "list"));
      if (next === html) return { summary: summary(`No grammar fixes needed in ${what}.`), ops: [] };
      return { summary: summary(`Fixed capitalisation and punctuation in ${what}.`), ops: [textOp(next)] };
    }
    case "translate": {
      if (!hasText) return { summary: summary(`There is no text to translate in ${what}.`), ops: [] };
      const next = mapLines(html, (line, i) => (i === 0 ? clip(`[${intent.language}] ${line}`, limit + intent.language.length + 3) : line));
      return { summary: summary(`Marked ${what} for translation to ${intent.language} (offline mode cannot translate; connect an AI key for a real translation).`), ops: [textOp(next)] };
    }
    case "bigger":
    case "smaller": {
      const base = el?.style.fontSize ?? TYPE_SCALE[role];
      const fontSize = intent.kind === "bigger" ? base + FONT_STEP : Math.max(MIN_FONT_SIZE, base - FONT_STEP);
      return { summary: summary(`Set the font size of ${what} to ${fontSize}px.`), ops: [styleOp({ fontSize })] };
    }
    case "color":
      return { summary: summary(`Coloured ${what} ${intent.name}.`), ops: [styleOp({ color: intent.hex })] };
    case "align":
      return { summary: summary(`Aligned ${what} ${intent.align}.`), ops: [styleOp({ align: intent.align })] };
    default:
      return undefined;
  }
}

function reviseCard(scope: ElementScope, intent: Intent, lower: string, summary: (s: string) => string): Revision | undefined {
  const { slideIndex, elementId } = scope;
  const el = scope.element?.type === "card" ? scope.element : undefined;
  const what = describeElement(scope);
  const title = el?.title ?? scope.selection.text?.split("\n")[0] ?? "";
  const body = el?.body ?? scope.selection.text?.split("\n").slice(1).join(" ") ?? "";
  const wantsTitle = /\btitle\b|\bheading\b/.test(lower);
  const wantsBody = /\bbody\b|\bdescription\b|\btext\b/.test(lower);
  const field: "title" | "body" | "both" = wantsTitle && !wantsBody ? "title" : wantsBody && !wantsTitle ? "body" : intent.kind === "rewrite" || intent.kind === "punchier" ? "both" : "body";
  const cardOp = (patch: { title?: string; body?: string }): PatchOp => ({ op: "setCard", slideIndex, elementId, ...patch });

  const transform = (fn: (line: string, titleLike: boolean) => string): { title?: string; body?: string } => {
    const patch: { title?: string; body?: string } = {};
    if ((field === "title" || field === "both") && title) patch.title = clip(fn(title, true), LIMIT.cardTitle);
    if ((field === "body" || field === "both") && body) patch.body = clip(fn(body, false), LIMIT.cardBody);
    return patch;
  };
  const changed = (patch: { title?: string; body?: string }) => (patch.title !== undefined && patch.title !== title) || (patch.body !== undefined && patch.body !== body);
  const fieldName = field === "both" ? "title and body" : field;

  switch (intent.kind) {
    case "rewrite":
    case "punchier": {
      const patch = transform(intent.kind === "punchier" ? punchLine : rewriteLine);
      if (!changed(patch)) return { summary: summary(`The ${fieldName} of ${what} is already tight; no change made.`), ops: [] };
      return { summary: summary(`Rewrote the ${fieldName} of ${what}.`), ops: [cardOp(patch)] };
    }
    case "shorter": {
      const patch = transform((line) => halveLine(line));
      if (!changed(patch)) return { summary: summary(`There is nothing to shorten in ${what}.`), ops: [] };
      return { summary: summary(`Shortened the ${fieldName} of ${what}.`), ops: [cardOp(patch)] };
    }
    case "longer": {
      const patch = transform((line, titleLike) => lengthenLine(line, topicFor(scope, line, titleLike), titleLike));
      if (!changed(patch)) return { summary: summary(`There is nothing to expand in ${what}.`), ops: [] };
      return { summary: summary(`Expanded the ${fieldName} of ${what}.`), ops: [cardOp(patch)] };
    }
    case "grammar": {
      const patch = transform(fixGrammarLine);
      if (!changed(patch)) return { summary: summary(`No grammar fixes needed in ${what}.`), ops: [] };
      return { summary: summary(`Fixed capitalisation and punctuation in ${what}.`), ops: [cardOp(patch)] };
    }
    case "translate": {
      const patch: { title?: string; body?: string } = {};
      if (title) patch.title = clip(`[${intent.language}] ${title}`, LIMIT.cardTitle);
      if (body) patch.body = clip(`[${intent.language}] ${body}`, LIMIT.cardBody);
      if (!changed(patch)) return { summary: summary(`There is no text to translate in ${what}.`), ops: [] };
      return { summary: summary(`Marked ${what} for translation to ${intent.language} (offline mode cannot translate; connect an AI key for a real translation).`), ops: [cardOp(patch)] };
    }
    default:
      return undefined;
  }
}

function reviseImage(scope: ElementScope, intent: Intent, summary: (s: string) => string): Revision | undefined {
  const { slideIndex, elementId } = scope;
  const el = scope.element?.type === "image" ? scope.element : undefined;
  const what = describeElement(scope);
  const current = el?.query ?? scope.selection.imageQuery;
  switch (intent.kind) {
    case "newImage": {
      const query = freshImageQuery(scope.slideTitle, current);
      return { summary: summary(`New image idea for ${what}: ${query}.`), ops: [{ op: "setImage", slideIndex, elementId, query }] };
    }
    case "describeImage": {
      const query = clip(intent.query, LIMIT.imageQuery);
      return { summary: summary(`Described ${what} as "${query}".`), ops: [{ op: "setImage", slideIndex, elementId, query }] };
    }
    default:
      return undefined;
  }
}

/** Element-scoped heuristics. Returns undefined when nothing element-specific matched so slide / deck heuristics can run. */
function reviseElement(req: ReviseRequest, selection: ReviseSelection & { elementId: string }, summary: (s: string) => string): Revision | undefined {
  const slide = req.deck.slides[selection.slideIndex];
  const element = slide.elements.find((e) => e.id === selection.elementId);
  const type = element?.type ?? selection.elementType;
  if (!type) return undefined;
  const instruction = req.instruction.trim();
  const lower = instruction.toLowerCase();
  const intent = detectIntent(instruction, lower);
  if (!intent) return undefined;
  const scope: ElementScope = {
    slideIndex: selection.slideIndex,
    elementId: selection.elementId,
    type,
    element,
    selection,
    slideTitle: deriveContent(slide).title,
    deckTitle: req.deck.title,
  };
  const what = describeElement(scope);
  const { slideIndex, elementId } = scope;

  if (intent.kind === "delete") return { summary: summary(`Removed ${what}.`), ops: [{ op: "deleteElement", slideIndex, elementId }] };
  if (intent.kind === "duplicate") return { summary: summary(`Duplicated ${what}.`), ops: [{ op: "duplicateElement", slideIndex, elementId }] };

  const typed = type === "text" ? reviseText(scope, intent, summary) : type === "card" ? reviseCard(scope, intent, lower, summary) : type === "image" ? reviseImage(scope, intent, summary) : undefined;
  if (typed) return typed;

  if (intent.kind === "bigger" || intent.kind === "smaller") {
    const op = scaledBox(scope, intent.kind === "bigger" ? GROW : SHRINK);
    if (op) return { summary: summary(`Made ${what} ${intent.kind === "bigger" ? "larger" : "smaller"}.`), ops: [op] };
  }
  if (intent.kind === "color" || intent.kind === "align") {
    return { summary: summary(`${UNMAPPED} ${capitalize(intent.kind === "color" ? "colour" : "alignment")} applies to text elements offline; select a text element.`), ops: [] };
  }
  if (intent.kind === "translate" || intent.kind === "grammar" || intent.kind === "rewrite" || intent.kind === "punchier" || intent.kind === "shorter" || intent.kind === "longer") {
    return { summary: summary(`${UNMAPPED} ${capitalize(what)} has no editable text.`), ops: [] };
  }
  return undefined;
}

/** Slide- and deck-scoped heuristics: title, theme, add / remove slide, shorter, longer. */
function reviseSlides(req: ReviseRequest, selected: number | undefined, summary: (s: string) => string): Revision {
  const instruction = req.instruction.trim();
  const lower = instruction.toLowerCase();
  const slides = req.deck.slides;
  const targets = (): number[] => (selected !== undefined ? [selected] : slides.map((_, i) => i));

  const titleMatch = /^\s*(?:set\s+|change\s+|rename\s+)?(?:the\s+)?(?:deck\s+)?title\s*(?::|to)\s*(.+)$/i.exec(instruction);
  if (titleMatch) {
    const title = clip(titleMatch[1].replace(/^["“']|["”']$/g, ""), 80);
    return { summary: summary(`Renamed the deck to "${title}".`), ops: [{ op: "setTitle", title }] };
  }

  if (/\btheme\b/.test(lower)) {
    const themeId = matchTheme(instruction);
    if (themeId) {
      return { summary: summary(`Switched the theme to ${THEME_NAMES[themeId]}.`), ops: [{ op: "setTheme", themeId }] };
    }
    return { summary: summary(`${UNMAPPED} Themes available: ${Object.values(THEME_NAMES).join(", ")}.`), ops: [] };
  }

  const addMatch = /\b(?:add|insert|create|include)\s+(?:a\s+|an\s+|one\s+|new\s+|another\s+)*slide\s+(?:about|on|for|covering|explaining|introducing|titled|called)\s+(.+)$/i.exec(instruction);
  if (addMatch) {
    const subject = addMatch[1].trim();
    const lastIndex = slides.length - 1;
    const hasClosing = slides.length > 0 && deriveContent(slides[lastIndex]).kind === "closing";
    const atIndex = selected !== undefined ? selected + 1 : hasClosing ? lastIndex : slides.length;
    return {
      summary: summary(`Added a slide about ${subject} at position ${atIndex + 1}.`),
      ops: [{ op: "insertSlide", atIndex, content: aboutSlide(subject) }],
    };
  }

  if (/\b(?:remove|delete|drop|cut)\b/.test(lower) && /\bslide\b/.test(lower)) {
    const numbered = parseSlideNumber(instruction);
    const index = numbered !== undefined && numbered >= 0 && numbered < slides.length ? numbered : selected;
    if (index === undefined) {
      return { summary: summary(`${UNMAPPED} Select a slide, or say which slide number to remove.`), ops: [] };
    }
    return { summary: summary(`Removed slide ${index + 1}.`), ops: [{ op: "deleteSlide", slideIndex: index }] };
  }

  if (/\b(?:shorter|shorten|concise|tighter|tighten|trim|condense|fewer words|less text)\b/.test(lower)) {
    const ops: PatchOp[] = targets().map((slideIndex) => ({ op: "replaceSlideContent", slideIndex, content: shorten(deriveContent(slides[slideIndex])) }));
    if (!ops.length) return { summary: UNMAPPED, ops: [] };
    return {
      summary: summary(selected !== undefined ? `Trimmed the copy on slide ${selected + 1}.` : `Trimmed the copy on all ${ops.length} slides.`),
      ops,
    };
  }

  if (/\b(?:longer|lengthen|expand|elaborate|more detail|more details|add detail|flesh out|more depth)\b/.test(lower)) {
    const ops: PatchOp[] = targets().map((slideIndex) => ({ op: "replaceSlideContent", slideIndex, content: lengthen(deriveContent(slides[slideIndex])) }));
    if (!ops.length) return { summary: UNMAPPED, ops: [] };
    return {
      summary: summary(selected !== undefined ? `Expanded slide ${selected + 1} with an extra point.` : `Expanded all ${ops.length} slides with an extra point.`),
      ops,
    };
  }

  return { summary: UNMAPPED, ops: [] };
}

export function mockRevise(req: ReviseRequest): Revision {
  const slides = req.deck.slides;
  const summary = (s: string) => clip(s, LIMIT.summary);

  // Element scope: only the selected element may change.
  const sel = req.selection;
  if (sel && sel.elementId && sel.slideIndex < slides.length) {
    const scoped = reviseElement(req, { ...sel, elementId: sel.elementId }, summary);
    if (scoped) return scoped;
  }

  // Slide scope: an explicit selectedSlideIndex wins, else the selection's slide.
  const slideFromSelection = sel && sel.slideIndex < slides.length ? sel.slideIndex : undefined;
  const selected = req.selectedSlideIndex !== undefined && req.selectedSlideIndex < slides.length ? req.selectedSlideIndex : slideFromSelection;
  return reviseSlides(req, selected, summary);
}
