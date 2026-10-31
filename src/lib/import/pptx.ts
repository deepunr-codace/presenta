import JSZip from "jszip";
import { newId } from "@/lib/deck/ids";
import { STAGE_H, STAGE_W, type Deck, type Element as DeckElement, type Slide } from "@/lib/deck/schema";
import { escapeHtml } from "@/lib/text";

/**
 * PowerPoint (.pptx) import. Reads each slide together with its layout, master and theme, so inherited positions,
 * backgrounds, template decorations and theme colours come through; walks into grouped shapes; and turns text boxes,
 * shapes, pictures (cropped as on the slide), charts and tables into editable elements.
 */

const MAX_FILE_BYTES = 50 * 1024 * 1024;
/** Pictures embedded in the deck, after scaling down; the rest are skipped and reported in the slide notes. */
const MAX_IMAGE_BYTES = 60 * 1024 * 1024;
const MAX_IMAGE_SIDE = 2400;
const EMU_PER_PT = 12700;

/* ---------- XML helpers ---------- */

function parse(value: string): Document {
  const doc = new DOMParser().parseFromString(value, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("This PowerPoint file contains invalid slide data.");
  return doc;
}

async function readXml(zip: JSZip, path: string): Promise<Document | null> {
  const entry = zip.file(path);
  return entry ? parse(await entry.async("string")) : null;
}

/** First descendant with this local name. */
function first(parent: Element | Document | null | undefined, name: string): Element | null {
  return parent?.getElementsByTagNameNS("*", name).item(0) ?? null;
}

/** Direct child with this local name. */
function child(parent: Element | null | undefined, name: string): Element | null {
  if (!parent) return null;
  for (const c of Array.from(parent.children)) if (c.localName === name) return c;
  return null;
}

function children(parent: Element | null | undefined, name: string): Element[] {
  return parent ? Array.from(parent.children).filter((c) => c.localName === name) : [];
}

function num(node: Element | null | undefined, key: string, fallback = 0): number {
  const raw = node?.getAttribute(key);
  if (raw == null || raw === "") return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function relId(node: Element | null): string {
  if (!node) return "";
  for (const a of Array.from(node.attributes)) if (a.localName === "embed" || a.localName === "id") return a.value;
  return "";
}

function relsPath(part: string): string {
  const slash = part.lastIndexOf("/");
  return `${part.slice(0, slash)}/_rels/${part.slice(slash + 1)}.rels`;
}

function resolveTarget(part: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const out: string[] = [];
  for (const piece of `${part.slice(0, part.lastIndexOf("/"))}/${target}`.split("/")) {
    if (!piece || piece === ".") continue;
    if (piece === "..") out.pop();
    else out.push(piece);
  }
  return out.join("/");
}

type Rels = { byId: Map<string, string>; byType: Map<string, string> };

async function readRels(zip: JSZip, part: string): Promise<Rels> {
  const doc = await readXml(zip, relsPath(part));
  const byId = new Map<string, string>();
  const byType = new Map<string, string>();
  for (const rel of Array.from(doc?.getElementsByTagNameNS("*", "Relationship") ?? [])) {
    if (rel.getAttribute("TargetMode") === "External") continue;
    const target = resolveTarget(part, rel.getAttribute("Target") ?? "");
    byId.set(rel.getAttribute("Id") ?? "", target);
    const type = rel.getAttribute("Type")?.split("/").pop() ?? "";
    if (!byType.has(type)) byType.set(type, target);
  }
  return { byId, byType };
}

/* ---------- Colours ---------- */

type Theme = { colors: Record<string, string>; majorFont: string; minorFont: string };

const DEFAULT_SCHEME: Record<string, string> = {
  dk1: "000000", lt1: "FFFFFF", dk2: "44546A", lt2: "E7E6E6",
  accent1: "4472C4", accent2: "ED7D31", accent3: "A5A5A5", accent4: "FFC000", accent5: "5B9BD5", accent6: "70AD47",
  hlink: "0563C1", folHlink: "954F72",
};
const SCHEME_ALIAS: Record<string, string> = { tx1: "dk1", bg1: "lt1", tx2: "dk2", bg2: "lt2" };
const PRESET: Record<string, string> = { black: "000000", white: "FFFFFF", red: "FF0000", green: "008000", blue: "0000FF", yellow: "FFFF00", gray: "808080", grey: "808080" };

function readTheme(doc: Document | null): Theme {
  const colors = { ...DEFAULT_SCHEME };
  const scheme = first(doc, "clrScheme");
  for (const c of Array.from(scheme?.children ?? [])) {
    const value = child(c, "srgbClr")?.getAttribute("val") ?? child(c, "sysClr")?.getAttribute("lastClr");
    if (value && /^[\da-f]{6}$/i.test(value)) colors[c.localName] = value.toUpperCase();
  }
  return {
    colors,
    majorFont: first(first(doc, "majorFont"), "latin")?.getAttribute("typeface") ?? "",
    minorFont: first(first(doc, "minorFont"), "latin")?.getAttribute("typeface") ?? "",
  };
}

function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function rgbToHsl([r, g, b]: [number, number, number]): [number, number, number] {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return [h / 6, s, l];
}

function hslToRgb([h, s, l]: [number, number, number]): [number, number, number] {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    const u = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (u < 1 / 6) return p + (q - p) * 6 * u;
    if (u < 1 / 2) return q;
    if (u < 2 / 3) return p + (q - p) * (2 / 3 - u) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

type Color = { rgb: [number, number, number]; alpha: number };

/** A DrawingML colour (srgb, scheme, system or preset) with its lum/tint/shade/alpha modifiers applied. */
function readColor(parent: Element | null | undefined, theme: Theme): Color | null {
  if (!parent) return null;
  const node = Array.from(parent.children).find((c) => ["srgbClr", "schemeClr", "sysClr", "prstClr", "scrgbClr"].includes(c.localName));
  if (!node) return null;
  let hex: string | null = null;
  if (node.localName === "srgbClr") hex = node.getAttribute("val");
  else if (node.localName === "sysClr") hex = node.getAttribute("lastClr") ?? (node.getAttribute("val") === "window" ? "FFFFFF" : "000000");
  else if (node.localName === "prstClr") hex = PRESET[node.getAttribute("val") ?? ""] ?? null;
  else if (node.localName === "schemeClr") {
    const key = node.getAttribute("val") ?? "";
    hex = theme.colors[SCHEME_ALIAS[key] ?? key] ?? null;
  } else if (node.localName === "scrgbClr") {
    const pct = (k: string) => Math.round((num(node, k) / 100000) * 255);
    hex = [pct("r"), pct("g"), pct("b")].map((v) => v.toString(16).padStart(2, "0")).join("");
  }
  if (!hex || !/^[\da-f]{6}$/i.test(hex)) return null;
  let rgb = hexToRgb(hex);
  let alpha = 1;
  for (const mod of Array.from(node.children)) {
    const v = num(mod, "val", 100000) / 100000;
    if (mod.localName === "alpha") alpha = v;
    else if (mod.localName === "lumMod" || mod.localName === "lumOff") {
      const hsl = rgbToHsl(rgb);
      hsl[2] = Math.max(0, Math.min(1, mod.localName === "lumMod" ? hsl[2] * v : hsl[2] + v));
      rgb = hslToRgb(hsl);
    } else if (mod.localName === "tint") rgb = rgb.map((c) => c + (255 - c) * (1 - v)) as Color["rgb"];
    else if (mod.localName === "shade") rgb = rgb.map((c) => c * v) as Color["rgb"];
  }
  return { rgb: rgb.map((c) => Math.round(Math.max(0, Math.min(255, c)))) as Color["rgb"], alpha };
}

function css(c: Color): string {
  if (c.alpha >= 0.999) return "#" + c.rgb.map((v) => v.toString(16).padStart(2, "0")).join("");
  return `rgba(${c.rgb.join(", ")}, ${Math.round(c.alpha * 1000) / 1000})`;
}

type Fill = { kind: "none" } | { kind: "color"; css: string } | { kind: "gradient"; css: string } | { kind: "image"; blip: Element; part: string } | null;

/** The fill inside spPr / bgPr: none, a colour, a gradient as CSS, or a picture. Null when it inherits. */
function readFill(props: Element | null | undefined, theme: Theme, part: string): Fill {
  if (!props) return null;
  if (child(props, "noFill")) return { kind: "none" };
  const solid = child(props, "solidFill");
  if (solid) {
    const c = readColor(solid, theme);
    return c ? { kind: "color", css: css(c) } : null;
  }
  const grad = child(props, "gradFill");
  if (grad) {
    const stops = Array.from(first(grad, "gsLst")?.children ?? [])
      .map((gs) => ({ pos: num(gs, "pos") / 1000, c: readColor(gs, theme) }))
      .filter((s): s is { pos: number; c: Color } => Boolean(s.c))
      .sort((a, b) => a.pos - b.pos);
    if (!stops.length) return null;
    if (stops.length === 1) return { kind: "color", css: css(stops[0].c) };
    const list = stops.map((s) => `${css(s.c)} ${Math.round(s.pos)}%`).join(", ");
    if (child(grad, "path")) return { kind: "gradient", css: `radial-gradient(circle, ${list})` };
    // DrawingML angles run clockwise from "left to right"; CSS from "bottom to top".
    const ang = num(child(grad, "lin"), "ang") / 60000;
    return { kind: "gradient", css: `linear-gradient(${Math.round((ang + 90) % 360)}deg, ${list})` };
  }
  const blip = child(props, "blipFill");
  if (blip) {
    const b = child(blip, "blip");
    return b ? { kind: "image", blip: blip, part } : null;
  }
  return null;
}

/* ---------- Geometry ---------- */

/** Maps file coordinates (EMU, possibly inside groups) to stage pixels. */
type Mapper = { a: number; d: number; e: number; f: number };

function compose(outer: Mapper, inner: Mapper): Mapper {
  return { a: outer.a * inner.a, d: outer.d * inner.d, e: outer.a * inner.e + outer.e, f: outer.d * inner.f + outer.f };
}

type Box = { x: number; y: number; w: number; h: number; rot: number; flipH: boolean; flipV: boolean };

function readXfrm(xfrm: Element | null, map: Mapper): Box | null {
  const off = child(xfrm, "off");
  const ext = child(xfrm, "ext");
  if (!off || !ext) return null;
  const x = num(off, "x") * map.a + map.e;
  const y = num(off, "y") * map.d + map.f;
  return {
    x,
    y,
    w: num(ext, "cx") * map.a,
    h: num(ext, "cy") * map.d,
    rot: (((num(xfrm, "rot") / 60000) % 360) + 360) % 360,
    flipH: xfrm?.getAttribute("flipH") === "1",
    flipV: xfrm?.getAttribute("flipV") === "1",
  };
}

/** Group: child coordinates (chOff/chExt) map onto the group's own box (off/ext). */
function groupMapper(grpSpPr: Element | null, map: Mapper): Mapper {
  const xfrm = child(grpSpPr, "xfrm");
  const off = child(xfrm, "off");
  const ext = child(xfrm, "ext");
  const chOff = child(xfrm, "chOff");
  const chExt = child(xfrm, "chExt");
  if (!off || !ext || !chOff || !chExt) return map;
  const sx = num(chExt, "cx") ? num(ext, "cx") / num(chExt, "cx") : 1;
  const sy = num(chExt, "cy") ? num(ext, "cy") / num(chExt, "cy") : 1;
  const inner: Mapper = { a: sx, d: sy, e: num(off, "x") - num(chOff, "x") * sx, f: num(off, "y") - num(chOff, "y") * sy };
  return compose(map, inner);
}

/* ---------- Placeholders and text defaults (layout, master) ---------- */

type TextDefaults = { size?: number; color?: string; bold?: boolean; align?: string };
type Placeholder = { type: string; idx: string; xfrm: Element | null; anchor?: string | null; defaults: TextDefaults };

function textDefaultsFrom(lvl: Element | null, theme: Theme): TextDefaults {
  const def = child(lvl, "defRPr");
  const out: TextDefaults = {};
  if (def?.getAttribute("sz")) out.size = num(def, "sz") / 100;
  const color = readColor(child(def, "solidFill"), theme);
  if (color) out.color = css(color);
  if (def?.getAttribute("b")) out.bold = def.getAttribute("b") === "1";
  if (lvl?.getAttribute("algn")) out.align = lvl.getAttribute("algn") ?? undefined;
  return out;
}

function placeholdersOf(doc: Document | null, theme: Theme): Placeholder[] {
  const tree = first(doc, "spTree");
  return Array.from(tree?.getElementsByTagNameNS("*", "sp") ?? []).flatMap((sp) => {
    const ph = first(child(sp, "nvSpPr"), "ph");
    if (!ph) return [];
    const body = child(sp, "txBody");
    return [
      {
        type: ph.getAttribute("type") ?? "body",
        idx: ph.getAttribute("idx") ?? "",
        xfrm: child(child(sp, "spPr"), "xfrm"),
        anchor: child(body, "bodyPr")?.getAttribute("anchor"),
        defaults: textDefaultsFrom(first(child(body, "lstStyle"), "lvl1pPr"), theme),
      },
    ];
  });
}

const SAME_ROLE: Record<string, string> = { ctrTitle: "title", title: "title", subTitle: "body", body: "body", obj: "body" };

function findPlaceholder(list: Placeholder[], type: string, idx: string): Placeholder | undefined {
  return (
    (idx ? list.find((p) => p.idx === idx) : undefined) ??
    list.find((p) => p.type === type) ??
    list.find((p) => SAME_ROLE[p.type] && SAME_ROLE[p.type] === SAME_ROLE[type])
  );
}

type MasterStyles = { title: TextDefaults; body: TextDefaults; other: TextDefaults };

function masterStyles(doc: Document | null, theme: Theme): MasterStyles {
  const styles = first(doc, "txStyles");
  const lvl = (name: string) => first(child(styles, name), "lvl1pPr");
  return { title: textDefaultsFrom(lvl("titleStyle"), theme), body: textDefaultsFrom(lvl("bodyStyle"), theme), other: textDefaultsFrom(lvl("otherStyle"), theme) };
}

/* ---------- Pictures ---------- */

function mimeFor(path: string): string | null {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  if (ext === "svg") return "image/svg+xml";
  if (ext === "bmp") return "image/bmp";
  return null;
}

function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${mime};base64,${btoa(binary)}`;
}

type Crop = { l: number; t: number; r: number; b: number };

/**
 * A picture ready for a slide: cropped like the slide shows it (srcRect), and scaled down to at most 2400 px so a deck
 * full of camera photos stays light. SVG and small untouched pictures are kept as they are.
 */
async function pictureSrc(bytes: Uint8Array, mime: string, crop: Crop | null): Promise<string | null> {
  if (mime === "image/svg+xml" || (!crop && bytes.byteLength < 600_000 && mime !== "image/bmp")) return bytesToDataUrl(bytes, mime);
  try {
    const bitmap = await createImageBitmap(new Blob([bytes as BlobPart], { type: mime }));
    const sx = crop ? bitmap.width * crop.l : 0;
    const sy = crop ? bitmap.height * crop.t : 0;
    const sw = bitmap.width * (1 - (crop ? crop.l + crop.r : 0));
    const sh = bitmap.height * (1 - (crop ? crop.t + crop.b : 0));
    if (sw < 1 || sh < 1) return null;
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(sw, sh));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(sw * scale));
    canvas.height = Math.max(1, Math.round(sh * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const keepAlpha = mime === "image/png" || mime === "image/gif" || mime === "image/webp";
    const out = canvas.toDataURL(keepAlpha ? "image/png" : "image/jpeg", 0.88);
    canvas.width = 0;
    return out;
  } catch {
    return null;
  }
}

/* ---------- Walking a slide ---------- */

type Part = { path: string; rels: Rels };

type Ctx = {
  zip: JSZip;
  theme: Theme;
  /** Points to stage pixels for font sizes. */
  ptToPx: number;
  styles: MasterStyles;
  layoutPh: Placeholder[];
  masterPh: Placeholder[];
  images: { bytes: number; skipped: number };
  elements: DeckElement[];
};

function base(box: Box, z: number) {
  return { id: newId("el"), x: box.x, y: box.y, w: Math.max(1, box.w), h: Math.max(1, box.h), rotation: box.rot, z, locked: false, opacity: 1 };
}

async function pictureElement(ctx: Ctx, part: Part, blipFill: Element, box: Box, radius = 0): Promise<DeckElement | null> {
  const target = part.rels.byId.get(relId(child(blipFill, "blip")));
  const entry = target ? ctx.zip.file(target) : null;
  const mime = target ? mimeFor(target) : null;
  if (!entry || !mime) {
    if (target) ctx.images.skipped += 1;
    return null;
  }
  const rect = child(blipFill, "srcRect");
  const crop = rect ? { l: num(rect, "l") / 100000, t: num(rect, "t") / 100000, r: num(rect, "r") / 100000, b: num(rect, "b") / 100000 } : null;
  const bytes = await entry.async("uint8array");
  const src = await pictureSrc(bytes, mime, crop && (crop.l || crop.t || crop.r || crop.b) ? crop : null);
  if (!src) {
    ctx.images.skipped += 1;
    return null;
  }
  const size = Math.floor(src.length * 0.75);
  if (ctx.images.bytes + size > MAX_IMAGE_BYTES) {
    ctx.images.skipped += 1;
    return null;
  }
  ctx.images.bytes += size;
  return { ...base(box, ctx.elements.length), type: "image", src, alt: "Imported picture", fit: "cover", radius, position: "50% 50%", overlay: 0 } as DeckElement;
}

function geometryOf(spPr: Element | null): { kind: "rect" | "ellipse" | "pill" | "line"; radiusFactor: number } {
  const prst = child(spPr, "prstGeom")?.getAttribute("prst") ?? (child(spPr, "custGeom") ? "rect" : "rect");
  if (prst === "ellipse" || prst === "circle") return { kind: "ellipse", radiusFactor: 0 };
  if (prst === "line" || prst === "straightConnector1") return { kind: "line", radiusFactor: 0 };
  if (prst === "roundRect" || prst === "round2SameRect" || prst === "snipRoundRect") {
    const adj = child(first(child(spPr, "prstGeom"), "avLst"), "gd");
    const v = adj ? Number(/val\s+(\d+)/.exec(adj.getAttribute("fmla") ?? "")?.[1] ?? 16667) : 16667;
    return { kind: "rect", radiusFactor: v / 100000 };
  }
  return { kind: "rect", radiusFactor: 0 };
}

/** Text, as one HTML block of paragraphs and bullet lists, with the styles most of it uses. */
function readText(body: Element, ctx: Ctx, defaults: TextDefaults, fontScale: number) {
  const paragraphs = children(body, "p");
  const sizes = new Map<number, number>();
  const colors = new Map<string, number>();
  let boldChars = 0;
  let chars = 0;
  let align: string | undefined;
  let html = "";
  let inList = false;
  for (const p of paragraphs) {
    const pPr = child(p, "pPr");
    align ??= pPr?.getAttribute("algn") ?? undefined;
    const pDef = child(pPr, "defRPr");
    let content = "";
    for (const run of Array.from(p.children)) {
      if (run.localName === "br") {
        content += "<br>";
        continue;
      }
      if (run.localName !== "r" && run.localName !== "fld") continue;
      const text = child(run, "t")?.textContent ?? "";
      if (!text) continue;
      const rPr = child(run, "rPr");
      const size = (num(rPr, "sz", 0) || num(pDef, "sz", 0) || (defaults.size ?? 18) * 100) / 100;
      sizes.set(size, (sizes.get(size) ?? 0) + text.length);
      const color = readColor(child(rPr, "solidFill"), ctx.theme) ?? readColor(child(pDef, "solidFill"), ctx.theme);
      const key = color ? css(color) : defaults.color ?? "";
      if (key) colors.set(key, (colors.get(key) ?? 0) + text.length);
      const bold = rPr?.getAttribute("b") ? rPr.getAttribute("b") === "1" : Boolean(defaults.bold);
      if (bold) boldChars += text.length;
      chars += text.length;
      let safe = escapeHtml(text);
      if (rPr?.getAttribute("i") === "1") safe = `<em>${safe}</em>`;
      if (bold) safe = `<strong>${safe}</strong>`;
      content += safe;
    }
    const bullet = Boolean(child(pPr, "buChar") || child(pPr, "buAutoNum")) && !child(pPr, "buNone");
    if (bullet && !inList) {
      html += "<ul>";
      inList = true;
    }
    if (!bullet && inList) {
      html += "</ul>";
      inList = false;
    }
    html += bullet ? `<li>${content}</li>` : `<p>${content || "<br>"}</p>`;
  }
  if (inList) html += "</ul>";
  if (!chars) return null;
  const top = <K,>(m: Map<K, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const pt = top(sizes) ?? defaults.size ?? 18;
  // Bold only when most of the text is bold, so one bold word does not make the whole box bold.
  const allBold = boldChars / chars > 0.6;
  return {
    html: allBold ? html.replace(/<\/?strong>/g, "") : html,
    fontSize: Math.max(8, Math.round(pt * fontScale * ctx.ptToPx)),
    color: top(colors) ?? defaults.color,
    bold: allBold,
    align: (align ?? defaults.align) === "ctr" ? "center" : (align ?? defaults.align) === "r" ? "right" : "left",
  } as const;
}

async function walk(ctx: Ctx, part: Part, tree: Element, map: Mapper, isSlide: boolean): Promise<void> {
  for (const node of Array.from(tree.children)) {
    if (ctx.elements.length >= 300) return;
    const name = node.localName;
    if (name === "grpSp") {
      await walk(ctx, part, node, groupMapper(child(node, "grpSpPr"), map), isSlide);
      continue;
    }
    if (name === "AlternateContent") {
      const choice = child(node, "Choice") ?? child(node, "Fallback");
      if (choice) await walk(ctx, part, choice, map, isSlide);
      continue;
    }
    if (name === "pic") {
      const box = readXfrm(child(child(node, "spPr"), "xfrm"), map);
      const blipFill = child(node, "blipFill");
      if (box && blipFill) {
        const geo = geometryOf(child(node, "spPr"));
        const el = await pictureElement(ctx, part, blipFill, box, Math.round(geo.radiusFactor * Math.min(box.w, box.h)));
        if (el) ctx.elements.push(el);
      }
      continue;
    }
    if (name === "graphicFrame") {
      const box = readXfrm(child(node, "xfrm"), map);
      if (!box) continue;
      const chart = await importChart(ctx, part, node, box);
      if (chart) {
        ctx.elements.push(chart);
        continue;
      }
      const table = first(node, "tbl");
      if (table) {
        const rows = children(table, "tr").map((tr) => children(tr, "tc").map((tc) => Array.from(tc.getElementsByTagNameNS("*", "t")).map((t) => t.textContent ?? "").join(" ").trim()));
        const html = rows.map((cells) => `<p>${cells.map(escapeHtml).join(" · ")}</p>`).join("");
        if (rows.length) ctx.elements.push({ ...base(box, ctx.elements.length), type: "text", role: "body", html, align: "left", valign: "top", autoFit: true, style: { fontSize: Math.max(12, Math.round(14 * ctx.ptToPx)), fontFamily: "body", fontWeight: 400 } } as DeckElement);
      }
      continue;
    }
    if (name !== "sp" && name !== "cxnSp") continue;

    const nv = child(node, name === "sp" ? "nvSpPr" : "nvCxnSpPr");
    const ph = first(nv, "ph");
    // On layouts and masters, placeholders are only templates for slides; their own text is prompt text.
    if (ph && !isSlide) continue;
    const phType = ph?.getAttribute("type") ?? "body";
    const phIdx = ph?.getAttribute("idx") ?? "";
    const inherited = ph ? findPlaceholder(ctx.layoutPh, phType, phIdx) ?? findPlaceholder(ctx.masterPh, phType, phIdx) : undefined;
    const masterPh = ph ? findPlaceholder(ctx.masterPh, phType, phIdx) : undefined;
    const spPr = child(node, "spPr");
    const box = readXfrm(child(spPr, "xfrm"), map) ?? (inherited ? readXfrm(inherited.xfrm, map) : null) ?? (masterPh ? readXfrm(masterPh.xfrm, map) : null);
    if (!box) continue;

    // Shape: its own fill, else the theme style reference colour.
    const fill = readFill(spPr, ctx.theme, part.path) ?? (() => {
      const ref = first(child(node, "style"), "fillRef");
      const c = ref && num(ref, "idx") > 0 ? readColor(ref, ctx.theme) : null;
      return c ? ({ kind: "color", css: css(c) } as Fill) : null;
    })();
    const ln = child(spPr, "ln");
    const lineColor = ln && !child(ln, "noFill") ? readColor(child(ln, "solidFill"), ctx.theme) ?? (num(first(child(node, "style"), "lnRef"), "idx") > 0 ? readColor(first(child(node, "style"), "lnRef"), ctx.theme) : null) : null;
    const lineWidth = lineColor ? Math.max(1, (num(ln, "w", 12700) / EMU_PER_PT) * ctx.ptToPx) : 0;
    const geo = geometryOf(spPr);

    if (fill?.kind === "image") {
      const el = await pictureElement(ctx, part, fill.blip, box, Math.round(geo.radiusFactor * Math.min(box.w, box.h)));
      if (el) ctx.elements.push(el);
    } else if (geo.kind === "line" || name === "cxnSp") {
      if (lineColor) {
        const thick = Math.max(lineWidth, 1);
        const horizontal = box.w >= box.h;
        ctx.elements.push({ ...base({ ...box, h: horizontal ? thick : box.h, w: horizontal ? box.w : thick }, ctx.elements.length), type: "shape", kind: "rect", fill: css(lineColor), strokeWidth: 0, radius: 0 } as DeckElement);
      }
    } else if ((fill && fill.kind !== "none") || lineColor) {
      const radius = geo.kind === "rect" ? Math.round(geo.radiusFactor * Math.min(box.w, box.h)) : 0;
      ctx.elements.push({
        ...base(box, ctx.elements.length),
        type: "shape",
        kind: geo.kind === "ellipse" ? "ellipse" : "rect",
        fill: fill && fill.kind !== "none" ? fill.css : "transparent",
        ...(lineColor ? { stroke: css(lineColor) } : {}),
        strokeWidth: lineColor ? Math.round(lineWidth) : 0,
        radius,
      } as DeckElement);
    }

    // Text on top of its shape, inset like PowerPoint (0.1" left/right, 0.05" top/bottom by default).
    const body = child(node, "txBody");
    if (!body) continue;
    const bodyPr = child(body, "bodyPr");
    const isTitle = phType === "title" || phType === "ctrTitle";
    const defaults: TextDefaults = {
      ...(isTitle ? ctx.styles.title : ph ? ctx.styles.body : ctx.styles.other),
      ...(masterPh?.defaults ?? {}),
      ...(inherited?.defaults ?? {}),
      ...textDefaultsFrom(first(child(body, "lstStyle"), "lvl1pPr"), ctx.theme),
    };
    const fontScale = num(child(bodyPr, "normAutofit"), "fontScale", 100000) / 100000;
    const text = readText(body, ctx, defaults, fontScale);
    if (!text) continue;
    const ins = (k: string, d: number) => num(bodyPr, k, d) * map.a;
    const left = ins("lIns", 91440);
    const right = ins("rIns", 91440);
    const topIns = ins("tIns", 45720);
    const bottom = ins("bIns", 45720);
    const anchor = bodyPr?.getAttribute("anchor") ?? inherited?.anchor ?? (isTitle ? "ctr" : "t");
    const tb: Box = { ...box, x: box.x + left, y: box.y + topIns, w: Math.max(8, box.w - left - right), h: Math.max(8, box.h - topIns - bottom) };
    ctx.elements.push({
      ...base(tb, ctx.elements.length),
      type: "text",
      role: isTitle ? "title" : phType === "subTitle" ? "subtitle" : "body",
      html: text.html,
      align: text.align,
      valign: anchor === "ctr" ? "middle" : anchor === "b" ? "bottom" : "top",
      autoFit: false,
      style: {
        fontSize: text.fontSize,
        fontWeight: text.bold ? 700 : 400,
        fontFamily: isTitle ? "display" : "body",
        lineHeight: 1.15,
        ...(text.color ? { color: text.color } : {}),
      },
    } as DeckElement);
  }
}

/* ---------- Charts ---------- */

function cachedValues(parent: Element | null): string[] {
  if (!parent) return [];
  const cache = first(parent, "strCache") ?? first(parent, "numCache");
  if (!cache) {
    const value = first(parent, "v")?.textContent?.trim();
    return value ? [value] : [];
  }
  const points = Array.from(cache.getElementsByTagNameNS("*", "pt"))
    .map((point) => ({ index: num(point, "idx", -1), value: first(point, "v")?.textContent?.trim() ?? "" }))
    .filter((point) => point.index >= 0 && point.index < 100)
    .sort((a, b) => a.index - b.index);
  const result: string[] = [];
  for (const point of points) result[point.index] = point.value;
  return Array.from({ length: result.length }, (_, index) => result[index] ?? "");
}

async function importChart(ctx: Ctx, part: Part, frame: Element, box: Box): Promise<DeckElement | null> {
  const ref = first(frame, "chart");
  const target = ref ? part.rels.byId.get(relId(ref)) : undefined;
  const doc = target ? await readXml(ctx.zip, target).catch(() => null) : null;
  if (!doc) return null;
  const chartType = ["barChart", "bar3DChart", "lineChart", "areaChart", "doughnutChart", "pieChart"].find((name) => first(doc, name));
  if (!chartType) return null;
  const kind = chartType === "lineChart" ? "line" : chartType === "areaChart" ? "area" : chartType === "doughnutChart" || chartType === "pieChart" ? "donut" : "bar";
  const plot = first(doc, chartType)!;
  const chartSeries = Array.from(plot.getElementsByTagNameNS("*", "ser")).slice(0, 12);
  const series = chartSeries.flatMap((item, index) => {
    const values = cachedValues(first(item, "val")).slice(0, 100).map((value) => (value ? Number(value) : 0));
    if (!values.length || values.some((value) => !Number.isFinite(value))) return [];
    return [{ name: cachedValues(first(item, "tx"))[0] || `Series ${index + 1}`, values }];
  });
  if (!series.length) return null;
  const labels = cachedValues(first(chartSeries[0], "cat")).slice(0, 100).map((label, index) => label || String(index + 1));
  const count = Math.max(...series.map((item) => item.values.length));
  for (let index = labels.length; index < count; index += 1) labels.push(String(index + 1));
  return { ...base(box, ctx.elements.length), type: "chart", kind, labels: labels.slice(0, count), series } as DeckElement;
}

/* ---------- Backgrounds ---------- */

async function readBackground(ctx: Ctx, docs: { doc: Document | null; part: Part }[]): Promise<Slide["background"] | null> {
  for (const { doc, part } of docs) {
    const bg = first(first(doc, "cSld"), "bg");
    if (!bg) continue;
    const bgPr = child(bg, "bgPr");
    const fill = bgPr ? readFill(bgPr, ctx.theme, part.path) : null;
    if (fill?.kind === "color") return { kind: "solid", color: fill.css };
    if (fill?.kind === "gradient") return { kind: "gradient", css: fill.css };
    if (fill?.kind === "image") {
      const el = await pictureElement(ctx, part, fill.blip, { x: 0, y: 0, w: STAGE_W, h: STAGE_H, rot: 0, flipH: false, flipV: false });
      if (el && el.type === "image" && el.src) return { kind: "image", src: el.src, overlay: 0 };
    }
    const ref = child(bg, "bgRef");
    const c = readColor(ref, ctx.theme);
    if (c) return { kind: "solid", color: css(c) };
  }
  return null;
}

/* ---------- Entry point ---------- */

async function slideNotes(zip: JSZip, rels: Rels): Promise<string> {
  const target = rels.byType.get("notesSlide");
  const doc = target ? await readXml(zip, target).catch(() => null) : null;
  if (!doc) return "";
  const notes: string[] = [];
  for (const shape of Array.from(doc.getElementsByTagNameNS("*", "sp"))) {
    const placeholder = first(shape, "ph")?.getAttribute("type");
    if (placeholder && placeholder !== "body") continue;
    const text = Array.from(first(shape, "txBody")?.getElementsByTagNameNS("*", "p") ?? [])
      .map((p) => Array.from(p.getElementsByTagNameNS("*", "t")).map((t) => t.textContent ?? "").join(""))
      .filter(Boolean)
      .join("\n")
      .trim();
    if (text) notes.push(text);
  }
  return notes.join("\n").slice(0, 400);
}

/** Imports a PowerPoint deck as editable slides. `report` gets progress 0–100 and a label. */
export async function importPptx(file: File, report?: (pct: number, label: string) => void): Promise<Deck> {
  if (file.size > MAX_FILE_BYTES) throw new Error("PowerPoint files must be smaller than 50 MB.");
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file, { checkCRC32: false });
  } catch {
    throw new Error("That file is not a readable PowerPoint presentation.");
  }
  const presentation = await readXml(zip, "ppt/presentation.xml");
  if (!presentation) throw new Error("This PowerPoint file is missing ppt/presentation.xml.");
  const size = first(presentation, "sldSz");
  const slideW = num(size, "cx", 12192000);
  const slideH = num(size, "cy", 6858000);
  // Uniform scale, centred, so 4:3 decks keep their proportions on the 16:9 stage.
  const scale = Math.min(STAGE_W / slideW, STAGE_H / slideH);
  const root: Mapper = { a: scale, d: scale, e: (STAGE_W - slideW * scale) / 2, f: (STAGE_H - slideH * scale) / 2 };
  const ptToPx = EMU_PER_PT * scale;

  const presRels = await readRels(zip, "ppt/presentation.xml");
  const fileSlides = Object.keys(zip.files).filter((path) => /^ppt\/slides\/slide\d+\.xml$/i.test(path));
  let slidePaths = Array.from(presentation.getElementsByTagNameNS("*", "sldId"))
    .map((node) => presRels.byId.get(relId(node)) ?? "")
    .filter((path) => fileSlides.includes(path));
  if (!slidePaths.length) slidePaths = fileSlides.sort((a, b) => Number(/slide(\d+)/i.exec(a)?.[1]) - Number(/slide(\d+)/i.exec(b)?.[1]));
  if (!slidePaths.length || slidePaths.length > 100) throw new Error("A PowerPoint import must contain between 1 and 100 slides.");

  const cache = new Map<string, Promise<{ doc: Document | null; rels: Rels }>>();
  const load = (path: string) => {
    if (!cache.has(path)) cache.set(path, Promise.all([readXml(zip, path), readRels(zip, path)]).then(([doc, rels]) => ({ doc, rels })));
    return cache.get(path)!;
  };

  const images = { bytes: 0, skipped: 0 };
  const slides: Slide[] = [];
  for (const [index, path] of slidePaths.entries()) {
    report?.(5 + Math.round((index / slidePaths.length) * 90), `Reading slide ${index + 1} of ${slidePaths.length}…`);
    const slide = await load(path);
    const layoutPath = slide.rels.byType.get("slideLayout");
    const layout = layoutPath ? await load(layoutPath) : { doc: null, rels: { byId: new Map<string, string>(), byType: new Map<string, string>() } as Rels };
    const masterPath = layout.rels.byType.get("slideMaster");
    const master = masterPath ? await load(masterPath) : { doc: null, rels: { byId: new Map<string, string>(), byType: new Map<string, string>() } as Rels };
    const themePath = master.rels.byType.get("theme");
    const theme = readTheme(themePath ? (await load(themePath)).doc : null);

    const ctx: Ctx = {
      zip,
      theme,
      ptToPx,
      styles: masterStyles(master.doc, theme),
      layoutPh: placeholdersOf(layout.doc, theme),
      masterPh: placeholdersOf(master.doc, theme),
      images,
      elements: [],
    };
    const skippedBefore = images.skipped;
    // Template decorations first (master, then layout), unless the slide or layout hides them.
    const showMaster = first(slide.doc, "sld")?.getAttribute("showMasterSp") !== "0" && first(layout.doc, "sldLayout")?.getAttribute("showMasterSp") !== "0";
    if (showMaster && master.doc && masterPath) {
      const tree = first(master.doc, "spTree");
      if (tree) await walk(ctx, { path: masterPath, rels: master.rels }, tree, root, false);
    }
    if (first(slide.doc, "sld")?.getAttribute("showMasterSp") !== "0" && layout.doc && layoutPath) {
      const tree = first(layout.doc, "spTree");
      if (tree) await walk(ctx, { path: layoutPath, rels: layout.rels }, tree, root, false);
    }
    const tree = first(slide.doc, "spTree");
    if (tree) await walk(ctx, { path, rels: slide.rels }, tree, root, true);

    const background =
      (await readBackground(ctx, [
        { doc: slide.doc, part: { path, rels: slide.rels } },
        { doc: layout.doc, part: { path: layoutPath ?? "", rels: layout.rels } },
        { doc: master.doc, part: { path: masterPath ?? "", rels: master.rels } },
      ])) ?? { kind: "solid", color: "#" + theme.colors.lt1 };

    const elements = ctx.elements.map((el, z) => ({ ...el, z }));
    const notes = await slideNotes(zip, slide.rels);
    const skipped = images.skipped - skippedBefore;
    slides.push({
      id: newId("slide"),
      layoutId: "blank",
      background,
      elements,
      notes: [notes || `Imported from ${file.name} · slide ${index + 1}`, skipped ? `${skipped} picture(s) could not be imported (unsupported format or too large).` : ""].filter(Boolean).join("\n").slice(0, 400),
    });
  }
  const now = new Date().toISOString();
  return { id: newId("deck"), title: file.name.replace(/\.pptx$/i, "").replace(/[_-]+/g, " ") || "Imported presentation", themeId: "paper", slides, createdAt: now, updatedAt: now, meta: { source: "import" }, version: 1 };
}
