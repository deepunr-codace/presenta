import JSZip from "jszip";
import type { ChartElement } from "@/lib/deck/schema";

const MAX_LABELS = 12;
const MAX_SERIES = 4;

function rowsFromCsv(input: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { cell += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell.length === 0) quoted = true;
    else if (char === delimiter) { row.push(cell.trim()); cell = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i += 1;
      row.push(cell.trim());
      if (row.some((value) => value !== "")) rows.push(row);
      row = []; cell = "";
    } else cell += char;
  }
  if (quoted) throw new Error("This CSV has an unfinished quoted field.");
  row.push(cell.trim());
  if (row.some((value) => value !== "")) rows.push(row);
  return rows;
}

function detectDelimiter(input: string): string {
  const firstLine = input.split(/\r?\n/, 1)[0] ?? "";
  const candidates = [",", "\t", ";"];
  return candidates.reduce((best, delimiter) => {
    const count = firstLine.split(delimiter).length;
    return count > firstLine.split(best).length ? delimiter : best;
  }, ",");
}

function numericValue(raw: string): number | null {
  if (!raw.trim()) return null;
  const normalized = raw.trim().replace(/[,$%\s\u20AC\u00A3\u00A5]/g, "");
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function chartDataFromRows(rows: string[][]): Pick<ChartElement, "labels" | "series"> {
  if (rows.length < 2 || rows[0].length < 2) throw new Error("Use a header row, a label column, and at least one numeric column.");

  const headers = rows[0];
  const records = rows.slice(1).filter((row) => row.some((value) => value !== ""));
  const numericColumns = headers.map((_, column) => column).filter((column) => {
    if (column === 0) return false;
    const values = records.map((row) => row[column] ?? "").filter((value) => value.trim() !== "");
    return values.length > 0 && values.every((value) => numericValue(value) !== null);
  });
  if (numericColumns.length === 0) throw new Error("No numeric data columns were found. Put category labels in column one and numbers in the next columns.");

  const selectedColumns = numericColumns.slice(0, MAX_SERIES);
  const selectedRecords = records.slice(0, MAX_LABELS);
  const labels = selectedRecords.map((row, index) => row[0]?.trim() || `Row ${index + 1}`);
  const series = selectedColumns.map((column) => ({
    name: headers[column]?.trim() || `Series ${column}`,
    values: selectedRecords.map((row) => numericValue(row[column] ?? "") ?? 0),
  }));
  return { labels, series };
}

/** Parse a header-row CSV into the chart's first-column labels and numeric series. */
export function chartDataFromCsv(input: string): Pick<ChartElement, "labels" | "series"> {
  const clean = input.replace(/^\uFEFF/, "").trim();
  if (!clean) throw new Error("The CSV file is empty.");
  return chartDataFromRows(rowsFromCsv(clean, detectDelimiter(clean)));
}

function columnIndex(reference: string): number {
  const letters = reference.match(/^[A-Z]+/i)?.[0]?.toUpperCase();
  if (!letters) return -1;
  return [...letters].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function xmlDocument(source: string): Document {
  const doc = new DOMParser().parseFromString(source, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("This Excel workbook contains invalid spreadsheet data.");
  return doc;
}

async function zipXml(zip: JSZip, path: string): Promise<Document> {
  const entry = zip.file(path);
  if (!entry) throw new Error("This Excel workbook is missing its first worksheet.");
  const source = await entry.async("string");
  if (source.length > 10 * 1024 * 1024) throw new Error("This worksheet is too large to import.");
  return xmlDocument(source);
}

/** Read the first worksheet from an .xlsx file (the first worksheet is the active import target). */
export async function chartDataFromXlsx(file: File): Promise<Pick<ChartElement, "labels" | "series">> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file, { checkCRC32: false });
  } catch {
    throw new Error("This is not a valid .xlsx workbook.");
  }
  const workbook = await zipXml(zip, "xl/workbook.xml");
  const firstSheet = workbook.getElementsByTagNameNS("*", "sheet").item(0);
  const relationId = firstSheet?.getAttribute("r:id") ?? firstSheet?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
  if (!relationId) throw new Error("This workbook does not contain a readable worksheet.");

  const relationships = await zipXml(zip, "xl/_rels/workbook.xml.rels");
  const relation = [...relationships.getElementsByTagNameNS("*", "Relationship")].find((item) => item.getAttribute("Id") === relationId);
  const target = relation?.getAttribute("Target");
  if (!target || target.startsWith("http") || target.includes("..")) throw new Error("This workbook's first worksheet could not be located.");
  const worksheetPath = target.startsWith("/") ? target.slice(1) : target.startsWith("xl/") ? target : `xl/${target}`;

  const sharedStrings = zip.file("xl/sharedStrings.xml");
  const shared = sharedStrings ? await zipXml(zip, "xl/sharedStrings.xml") : null;
  const strings = shared ? [...shared.getElementsByTagNameNS("*", "si")].map((item) => [...item.getElementsByTagNameNS("*", "t")].map((text) => text.textContent ?? "").join("")) : [];
  const sheet = await zipXml(zip, worksheetPath);
  const rows = [...sheet.getElementsByTagNameNS("*", "sheetData")].flatMap((data) => [...data.getElementsByTagNameNS("*", "row")]);
  const table: string[][] = [];
  for (const row of rows) {
    const values: string[] = [];
    for (const cell of [...row.getElementsByTagNameNS("*", "c")]) {
      const index = columnIndex(cell.getAttribute("r") ?? "");
      if (index < 0 || index > 1000) continue;
      while (values.length <= index) values.push("");
      const type = cell.getAttribute("t");
      const value = cell.getElementsByTagNameNS("*", "v").item(0)?.textContent ?? "";
      if (type === "s") values[index] = strings[Number(value)] ?? "";
      else if (type === "inlineStr") values[index] = [...cell.getElementsByTagNameNS("*", "t")].map((text) => text.textContent ?? "").join("");
      else values[index] = value;
    }
    if (values.some((value) => value !== "")) table.push(values);
  }
  return chartDataFromRows(table);
}

export const CHART_CSV_LIMITS = { labels: MAX_LABELS, series: MAX_SERIES } as const;
