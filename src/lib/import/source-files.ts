import JSZip from "jszip";

const MAX_SOURCE_CHARS = 40_000;
const MAX_ARCHIVE_BYTES = 25 * 1024 * 1024;
const MAX_OCR_PAGES = 40;
export const PDF_OCR_LANGUAGES = [
  { code: "eng", label: "English" }, { code: "spa", label: "Spanish" }, { code: "fra", label: "French" },
  { code: "deu", label: "German" }, { code: "por", label: "Portuguese" }, { code: "ita", label: "Italian" },
  { code: "nld", label: "Dutch" }, { code: "jpn", label: "Japanese" }, { code: "hin", label: "Hindi" },
] as const;
export type PdfOcrLanguage = (typeof PDF_OCR_LANGUAGES)[number]["code"];

let pdfJs: Promise<typeof import("pdfjs-dist")> | null = null;

export function getPdfJs(): Promise<typeof import("pdfjs-dist")> {
  pdfJs ??= import("pdfjs-dist").then((lib) => {
    lib.GlobalWorkerOptions.workerSrc = new URL("../../../node_modules/pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    return lib;
  });
  return pdfJs;
}

/** Extracts selectable PDF text and OCRs scanned pages in the browser. PDF pages are never uploaded. */
export async function extractPdfText(file: File, options: { language?: PdfOcrLanguage; onProgress?: (message: string) => void } = {}): Promise<string> {
  if (file.size > MAX_ARCHIVE_BYTES) throw new Error("Files must be smaller than 25 MB.");
  const lib = await getPdfJs();
  const task = lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), useSystemFonts: true });
  const pdf = await task.promise;
  try {
    const chunks: string[] = [];
    const scannedPages: number[] = [];
    let length = 0;
    if (pdf.numPages > 500) throw new Error("PDF source imports support up to 500 pages. Split the PDF and try again.");
    const pageLimit = Math.min(pdf.numPages, 500);
    for (let pageNumber = 1; pageNumber <= pageLimit && length < MAX_SOURCE_CHARS; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items.map((item) => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join("").replace(/[ \t]+\n/g, "\n").trim();
      if (!text) { scannedPages.push(pageNumber); continue; }
      const section = `Page ${pageNumber}\n${text}`;
      const remaining = MAX_SOURCE_CHARS - length;
      chunks.push(section.slice(0, remaining));
      length += Math.min(section.length, remaining) + 2;
    }
    if (scannedPages.length > MAX_OCR_PAGES) throw new Error(`This PDF has ${scannedPages.length} scanned pages. OCR supports up to ${MAX_OCR_PAGES} pages at a time; split the PDF and try again.`);
    if (scannedPages.length) {
      options.onProgress?.("Loading the OCR engine and language data…");
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker(options.language ?? "eng", 1).catch(() => {
        throw new Error("The OCR engine could not load. Check your connection and try again.");
      });
      try {
        for (let index = 0; index < scannedPages.length && length < MAX_SOURCE_CHARS; index += 1) {
          const pageNumber = scannedPages[index];
          options.onProgress?.(`Reading scanned page ${index + 1} of ${scannedPages.length}…`);
          const page = await pdf.getPage(pageNumber);
          const base = page.getViewport({ scale: 1 });
          const scale = Math.min(2.5, 2400 / Math.max(base.width, base.height));
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.ceil(viewport.width));
          canvas.height = Math.max(1, Math.ceil(viewport.height));
          const context = canvas.getContext("2d", { alpha: false });
          if (!context) throw new Error("This browser could not prepare the scanned PDF page for OCR.");
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, canvas.width, canvas.height);
          try {
            await page.render({ canvas, canvasContext: context, viewport, background: "#ffffff" }).promise;
            const recognized = await worker.recognize(canvas);
            const text = recognized.data.text.trim();
            if (!text) continue;
            const section = `Page ${pageNumber}\n${text}`;
            const remaining = MAX_SOURCE_CHARS - length;
            chunks.push(section.slice(0, remaining));
            length += Math.min(section.length, remaining) + 2;
          } finally {
            canvas.width = 0;
            canvas.height = 0;
          }
        }
      } finally {
        await worker.terminate();
      }
    }
    const result = chunks.join("\n\n").trim();
    if (!result) throw new Error("No readable text was found in this PDF. Try a clearer scan or a different OCR language.");
    return result;
  } finally {
    await task.destroy();
  }
}

function texts(xml: string, selector: string): string[] {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("This file contains invalid document data.");
  return Array.from(doc.getElementsByTagName(selector)).map((node) => node.textContent ?? "").filter(Boolean);
}

/** Extracts authored text from Office Open XML for use as AI source material. Layout and media are not imported. */
export async function extractOfficeText(file: File): Promise<string> {
  if (file.size > MAX_ARCHIVE_BYTES) throw new Error("Files must be smaller than 25 MB.");
  const zip = await JSZip.loadAsync(file, { checkCRC32: false });
  const isDocx = /\.docx$/i.test(file.name);
  const paths = isDocx
    ? ["word/document.xml"]
    : Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name)).sort((a, b) => {
        const ai = Number(a.match(/slide(\d+)\.xml/i)?.[1] ?? 0);
        const bi = Number(b.match(/slide(\d+)\.xml/i)?.[1] ?? 0);
        return ai - bi;
      });
  if (!paths.length || (isDocx && !zip.file(paths[0]))) throw new Error("Could not find readable text in this document.");
  const chunks: string[] = [];
  let length = 0;
  for (const path of paths) {
    const entry = zip.file(path);
    if (!entry) continue;
    const xml = await entry.async("string");
    const extracted = texts(xml, isDocx ? "w:t" : "a:t").join(" ").trim();
    if (!extracted) continue;
    const section = `${isDocx ? "" : `Slide ${chunks.length + 1}\n`}${extracted}`;
    const remaining = MAX_SOURCE_CHARS - length;
    if (remaining <= 0) break;
    chunks.push(section.slice(0, remaining));
    length += section.length + 2;
  }
  const result = chunks.join("\n\n").trim();
  if (!result) throw new Error("This file does not contain extractable text.");
  return result;
}
