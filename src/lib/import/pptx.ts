import JSZip from "jszip";
import { newId } from "@/lib/deck/ids";
import { STAGE_H, STAGE_W, type Deck, type Element as DeckElement, type Slide } from "@/lib/deck/schema";
import { escapeHtml } from "@/lib/text";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

function xml(zip: JSZip, path: string): Promise<Document> {
  const entry = zip.file(path);
  if (!entry) throw new Error(`This PowerPoint file is missing ${path}.`);
  return entry.async("string").then((value) => {
    const doc = new DOMParser().parseFromString(value, "application/xml");
    if (doc.querySelector("parsererror")) throw new Error("This PowerPoint file contains invalid slide data.");
    return doc;
  });
}

function first(parent: Element | Document | null, localName: string): Element | null {
  return parent?.getElementsByTagNameNS("*", localName).item(0) ?? null;
}

function attrNumber(node: Element | null, key: string, fallback = 0): number {
  const value = Number(node?.getAttribute(key));
  return Number.isFinite(value) ? value : fallback;
}

function shapeTransform(shape: Element): Element | null {
  return first(first(shape, "spPr"), "xfrm") ?? first(shape, "xfrm");
}

function rotation(xfrm: Element | null): number {
  const value = attrNumber(xfrm, "rot", 0) / 60_000;
  return ((value % 360) + 360) % 360;
}

function safeColor(parent: Element | null): string | null {
  if (!parent) return null;
  const rgb = first(parent, "srgbClr")?.getAttribute("val");
  if (rgb && /^[\da-f]{6}$/i.test(rgb)) return `#${rgb}`;
  const scheme = first(parent, "schemeClr")?.getAttribute("val");
  const colors: Record<string, string> = { tx1: "#18212f", dk1: "#18212f", lt1: "#ffffff", bg1: "#ffffff", accent1: "#3267d6", accent2: "#e36c47", accent3: "#6b9e84", accent4: "#875cc2", accent5: "#d4a72c", accent6: "#3e9eaa" };
  return scheme ? colors[scheme] ?? null : null;
}

function dataUrl(bytes: Uint8Array, mime: string): string {
  let binary = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) binary += String.fromCharCode(...bytes.subarray(i, i + step));
  return `data:${mime};base64,${btoa(binary)}`;
}

function runHtml(paragraph: Element): string {
  const runs = Array.from(paragraph.children).filter((node) => ["r", "fld", "br"].includes(node.localName));
  const content = runs.map((run) => {
    if (run.localName === "br") return "<br>";
    const text = Array.from(run.getElementsByTagNameNS("*", "t")).map((node) => node.textContent ?? "").join("");
    if (!text) return "";
    const props = first(run, "rPr");
    const bold = props?.getAttribute("b") === "1";
    const italic = props?.getAttribute("i") === "1";
    let safe = escapeHtml(text);
    if (italic) safe = `<em>${safe}</em>`;
    if (bold) safe = `<strong>${safe}</strong>`;
    return safe;
  }).join("");
  const props = first(paragraph, "pPr");
  const level = Math.max(0, Math.min(5, attrNumber(props, "lvl", 0)));
  const bullet = Boolean(first(props ?? paragraph, "buChar") || first(props ?? paragraph, "buAutoNum"));
  return bullet ? `<li>${"&nbsp;".repeat(level * 2)}${content}</li>` : `<p>${content}</p>`;
}

function textShape(shape: Element, index: number, z: number, slideW: number, slideH: number): DeckElement | null {
  const body = first(shape, "txBody");
  if (!body) return null;
  const paragraphNodes = Array.from(body.getElementsByTagNameNS("*", "p"));
  const paragraphs = paragraphNodes.map(runHtml).filter((line) => line !== "<p></p>");
  if (!paragraphs.length) return null;
  const xfrm = shapeTransform(shape);
  const off = first(xfrm ?? shape, "off");
  const ext = first(xfrm ?? shape, "ext");
  const hasOwnGeometry = Boolean(off && ext);
  const x = hasOwnGeometry ? attrNumber(off, "x") / slideW * STAGE_W : 128;
  const y = hasOwnGeometry ? attrNumber(off, "y") / slideH * STAGE_H : index === 0 ? 112 : 310 + (index - 1) * 170;
  const w = hasOwnGeometry ? attrNumber(ext, "cx") / slideW * STAGE_W : 1664;
  const h = hasOwnGeometry ? attrNumber(ext, "cy") / slideH * STAGE_H : index === 0 ? 160 : 620;
  const defaultSize = attrNumber(first(shape, "defRPr"), "sz", 1800) / 50;
  const placeholder = first(shape, "ph")?.getAttribute("type");
  const title = placeholder === "title" || placeholder === "ctrTitle" || (placeholder === null && index === 0);
  const subtitle = placeholder === "subTitle";
  const color = safeColor(first(first(shape, "rPr"), "solidFill"));
  const alignToken = first(first(body, "p"), "pPr")?.getAttribute("algn");
  const anchor = first(body, "bodyPr")?.getAttribute("anchor");
  const align = alignToken === "ctr" ? "center" : alignToken === "r" ? "right" : "left";
  const valign = anchor === "ctr" ? "middle" : anchor === "b" ? "bottom" : "top";
  let html = "";
  let inList = false;
  for (const paragraph of paragraphs) {
    const bullet = paragraph.startsWith("<li>");
    if (bullet && !inList) { html += "<ul>"; inList = true; }
    if (!bullet && inList) { html += "</ul>"; inList = false; }
    html += paragraph;
  }
  if (inList) html += "</ul>";
  return {
    id: newId("el"), type: "text", role: title ? "title" : subtitle ? "subtitle" : "body", html,
    x, y, w, h, rotation: rotation(xfrm), z, locked: false, opacity: 1,
    align, valign, autoFit: true,
    style: { fontSize: Math.max(12, Math.min(120, defaultSize)), fontWeight: title ? 700 : 400, fontFamily: title ? "display" : "body", ...(color ? { color } : {}) },
  } as DeckElement;
}

function shapeColor(shape: Element): string | null {
  return safeColor(first(first(shape, "spPr"), "solidFill"));
}

function importShape(shape: Element, slideW: number, slideH: number, z: number): DeckElement | null {
  const xfrm = shapeTransform(shape);
  const off = first(xfrm ?? shape, "off");
  const ext = first(xfrm ?? shape, "ext");
  if (!ext) return null;
  const prst = first(first(shape, "spPr"), "prstGeom")?.getAttribute("prst");
  const line = first(first(shape, "spPr"), "ln");
  const fill = shapeColor(shape);
  const stroke = safeColor(first(line, "solidFill"));
  const width = attrNumber(line, "w", 0) / slideW * STAGE_W;
  if (!fill && !stroke) return null;
  const isLine = prst === "line" || shape.localName === "cxnSp";
  const kind = prst === "ellipse" ? "ellipse" : prst === "roundRect" ? "pill" : isLine ? "line" : "rect";
  const height = attrNumber(ext, "cy") / slideH * STAGE_H;
  const lineColor = stroke ?? fill ?? "#18212f";
  return {
    id: newId("el"), type: "shape", kind,
    x: attrNumber(off, "x") / slideW * STAGE_W, y: attrNumber(off, "y") / slideH * STAGE_H,
    w: attrNumber(ext, "cx") / slideW * STAGE_W, h: isLine ? Math.max(2, height, width) : height,
    rotation: rotation(xfrm), z, locked: false, opacity: 1,
    fill: isLine ? lineColor : fill ?? "transparent", ...(!isLine && stroke ? { stroke } : {}), strokeWidth: !isLine && stroke ? Math.max(1, width) : 0,
    radius: 0,
  } as DeckElement;
}

function relationshipPath(slidePath: string): string {
  const slash = slidePath.lastIndexOf("/");
  return `${slidePath.slice(0, slash)}/_rels/${slidePath.slice(slash + 1)}.rels`;
}

function resolveTarget(slidePath: string, target: string): string {
  const parts = `${slidePath.slice(0, slidePath.lastIndexOf("/"))}/${target}`.split("/");
  const normalized: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") normalized.pop(); else normalized.push(part);
  }
  return normalized.join("/");
}

function relationshipMap(doc: Document, slidePath: string): Map<string, string> {
  return new Map(Array.from(doc.getElementsByTagNameNS("*", "Relationship")).map((rel) => [rel.getAttribute("Id") ?? "", resolveTarget(slidePath, rel.getAttribute("Target") ?? "")]));
}

function mimeFor(path: string): string | null {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "gif") return "image/gif";
  if (ext === "svg") return "image/svg+xml";
  if (ext === "png") return "image/png";
  return null;
}

async function slideNotes(zip: JSZip, relationships: Document, slidePath: string): Promise<string> {
  const relation = Array.from(relationships.getElementsByTagNameNS("*", "Relationship"))
    .find((item) => item.getAttribute("Type")?.endsWith("/notesSlide"));
  const target = relation?.getAttribute("Target");
  if (!target) return "";
  const path = resolveTarget(slidePath, target);
  const entry = zip.file(path);
  if (!entry) return "";
  const doc = new DOMParser().parseFromString(await entry.async("string"), "application/xml");
  if (doc.querySelector("parsererror")) return "";
  const notes: string[] = [];
  for (const shape of Array.from(doc.getElementsByTagNameNS("*", "sp"))) {
    const placeholder = first(shape, "ph")?.getAttribute("type");
    if (placeholder && placeholder !== "body") continue;
    const paragraphs = Array.from(first(shape, "txBody")?.getElementsByTagNameNS("*", "p") ?? []);
    const text = paragraphs.map((paragraph) => Array.from(paragraph.getElementsByTagNameNS("*", "t")).map((node) => node.textContent ?? "").join("")).filter(Boolean).join("\n").trim();
    if (text) notes.push(text);
  }
  return notes.join("\n").slice(0, 400);
}

function cachedValues(parent: Element | null): string[] {
  if (!parent) return [];
  const cache = first(parent, "strCache") ?? first(parent, "numCache");
  if (!cache) {
    const value = first(parent, "v")?.textContent?.trim();
    return value ? [value] : [];
  }
  const points = Array.from(cache.getElementsByTagNameNS("*", "pt"))
    .map((point) => ({ index: attrNumber(point, "idx", -1), value: first(point, "v")?.textContent?.trim() ?? "" }))
    .filter((point) => point.index >= 0 && point.index < 100)
    .sort((a, b) => a.index - b.index);
  const result: string[] = [];
  for (const point of points) result[point.index] = point.value;
  return Array.from({ length: result.length }, (_, index) => result[index] ?? "");
}

async function importChart(zip: JSZip, relationships: Map<string, string>, frame: Element, slideW: number, slideH: number, z: number): Promise<DeckElement | null> {
  const chartReference = first(frame, "chart");
  const relationId = chartReference && Array.from(chartReference.attributes).find((attribute) => attribute.localName === "id")?.value;
  const target = relationId ? relationships.get(relationId) : undefined;
  const entry = target ? zip.file(target) : null;
  if (!entry) return null;
  const doc = new DOMParser().parseFromString(await entry.async("string"), "application/xml");
  if (doc.querySelector("parsererror")) return null;
  const chartType = ["barChart", "lineChart", "areaChart", "doughnutChart", "pieChart"].find((name) => first(doc, name));
  if (!chartType) return null;
  const kind = chartType === "lineChart" ? "line" : chartType === "areaChart" ? "area" : chartType === "doughnutChart" || chartType === "pieChart" ? "donut" : "bar";
  const plot = first(doc, chartType)!;
  const chartSeries = Array.from(plot.getElementsByTagNameNS("*", "ser")).slice(0, 12);
  const series = chartSeries.flatMap((item, index) => {
    const values = cachedValues(first(item, "val")).slice(0, 100).map((value) => value ? Number(value) : 0);
    if (!values.length || values.some((value) => !Number.isFinite(value))) return [];
    const name = cachedValues(first(item, "tx"))[0] || `Series ${index + 1}`;
    return [{ name, values }];
  });
  if (!series.length) return null;
  const labels = cachedValues(first(chartSeries[0], "cat")).slice(0, 100).map((label, index) => label || String(index + 1));
  const count = Math.max(...series.map((item) => item.values.length));
  for (let index = labels.length; index < count; index += 1) labels.push(String(index + 1));
  const xfrm = first(frame, "xfrm");
  const off = first(xfrm ?? frame, "off");
  const ext = first(xfrm ?? frame, "ext");
  if (!ext) return null;
  return {
    id: newId("el"), type: "chart", kind, labels: labels.slice(0, count), series,
    x: attrNumber(off, "x") / slideW * STAGE_W, y: attrNumber(off, "y") / slideH * STAGE_H,
    w: attrNumber(ext, "cx") / slideW * STAGE_W, h: attrNumber(ext, "cy") / slideH * STAGE_H,
    rotation: rotation(xfrm), z, locked: false, opacity: 1,
  } as DeckElement;
}

/** Imports editable text, basic shapes, and embedded pictures from an Office Open XML presentation. */
export async function importPptx(file: File): Promise<Deck> {
  if (file.size > MAX_FILE_BYTES) throw new Error("PowerPoint files must be smaller than 20 MB.");
  let zip: JSZip;
  try { zip = await JSZip.loadAsync(file, { checkCRC32: false }); }
  catch { throw new Error("That file is not a readable PowerPoint presentation."); }
  const presentation = await xml(zip, "ppt/presentation.xml");
  const size = first(presentation, "sldSz");
  const slideW = attrNumber(size, "cx", 12192000);
  const slideH = attrNumber(size, "cy", 6858000);
  const fileSlidePaths = Object.keys(zip.files).filter((path) => /^ppt\/slides\/slide\d+\.xml$/i.test(path));
  const presentationRelsEntry = zip.file("ppt/_rels/presentation.xml.rels");
  let slidePaths: string[] = [];
  if (presentationRelsEntry) {
    const relText = await presentationRelsEntry.async("string");
    const relDoc = new DOMParser().parseFromString(relText, "application/xml");
    const rels = relationshipMap(relDoc, "ppt/presentation.xml");
    const ids = Array.from(presentation.getElementsByTagNameNS("*", "sldId"));
    slidePaths = ids.map((node) => {
      const relId = Array.from(node.attributes).find((attribute) => attribute.localName === "id")?.value;
      return relId ? rels.get(relId) ?? "" : "";
    }).filter((path) => fileSlidePaths.includes(path));
  }
  if (!slidePaths.length) slidePaths = fileSlidePaths.sort((a, b) => Number(a.match(/slide(\d+)/i)?.[1]) - Number(b.match(/slide(\d+)/i)?.[1]));
  if (!slidePaths.length || slidePaths.length > 100) throw new Error("A PowerPoint import must contain between 1 and 100 slides.");
  let imageBytes = 0;
  const slides: Slide[] = [];
  for (const [slideIndex, path] of slidePaths.entries()) {
    const [doc, relDoc] = await Promise.all([xml(zip, path), zip.file(relationshipPath(path))?.async("string").then((value) => new DOMParser().parseFromString(value, "application/xml")) ?? Promise.resolve(new DOMParser().parseFromString("<Relationships/>", "application/xml"))]);
    const rels = relationshipMap(relDoc, path);
    const tree = first(doc, "spTree");
    const nodes = tree ? Array.from(tree.children).filter((node) => ["sp", "pic", "cxnSp", "graphicFrame"].includes(node.localName)) : [];
    const elements: DeckElement[] = [];
    let textIndex = 0;
    for (const node of nodes) {
      if (node.localName === "sp") {
        const imported = textShape(node, textIndex, elements.length, slideW, slideH);
        if (imported) { elements.push(imported); textIndex += 1; }
        else { const shape = importShape(node, slideW, slideH, elements.length); if (shape) elements.push(shape); }
      } else if (node.localName === "cxnSp") {
        const connector = importShape(node, slideW, slideH, elements.length);
        if (connector) elements.push(connector);
      } else if (node.localName === "graphicFrame") {
        const chart = await importChart(zip, rels, node, slideW, slideH, elements.length);
        if (chart) elements.push(chart);
      } else if (node.localName === "pic") {
        const blip = first(node, "blip");
        const target = rels.get(blip?.getAttribute("embed") ?? "");
        const entry = target ? zip.file(target) : null;
        const mime = target ? mimeFor(target) : null;
        if (!entry || !target || !mime) continue;
        const bytes = await entry.async("uint8array");
        if (imageBytes + bytes.byteLength > MAX_IMAGE_BYTES) continue;
        imageBytes += bytes.byteLength;
        const xfrm = shapeTransform(node); const off = first(xfrm ?? node, "off"); const ext = first(xfrm ?? node, "ext");
        elements.push({ id: newId("el"), type: "image", src: dataUrl(bytes, mime), query: "", alt: "Imported picture", fit: "contain", radius: 0, position: "50% 50%", overlay: 0, x: attrNumber(off, "x") / slideW * STAGE_W, y: attrNumber(off, "y") / slideH * STAGE_H, w: attrNumber(ext, "cx") / slideW * STAGE_W, h: attrNumber(ext, "cy") / slideH * STAGE_H, rotation: rotation(xfrm), z: elements.length, locked: false, opacity: 1 });
      }
      if (elements.length >= 200) break;
    }
    if (!elements.length) elements.push({ id: newId("el"), type: "text", role: "body", html: "<p>Empty imported slide</p>", x: 120, y: 120, w: 1680, h: 120, rotation: 0, z: 0, locked: false, opacity: 1, align: "left", valign: "top", autoFit: true, style: { fontSize: 32, fontFamily: "body", fontWeight: 400 } });
    const background = first(first(doc, "bg"), "bgPr");
    const backgroundColor = safeColor(first(background, "solidFill")) ?? safeColor(first(background, "bgRef"));
    const notes = await slideNotes(zip, relDoc, path);
    slides.push({ id: newId("slide"), layoutId: "blank", background: backgroundColor ? { kind: "solid", color: backgroundColor } : { kind: "theme", variant: "default" }, elements, notes: notes || `Imported from ${file.name} · slide ${slideIndex + 1}` });
  }
  const now = new Date().toISOString();
  return { id: newId("deck"), title: file.name.replace(/\.pptx$/i, "").replace(/[_-]+/g, " ") || "Imported presentation", themeId: "paper", slides, createdAt: now, updatedAt: now, meta: { source: "import" }, version: 1 };
}
