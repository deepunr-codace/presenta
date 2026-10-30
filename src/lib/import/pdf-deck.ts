import { newId } from "@/lib/deck/ids";
import { STAGE_H, STAGE_W, type Deck, type Slide } from "@/lib/deck/schema";
import { getPdfJs } from "@/lib/import/source-files";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_SLIDES = 100;
const MAX_RENDERED_BYTES = 12 * 1024 * 1024;

/** Imports PDF pages as positioned images, preserving their appearance on an editable presentation canvas. */
export async function importPdfDeck(file: File): Promise<Deck> {
  if (file.size > MAX_FILE_BYTES) throw new Error("PDF files must be smaller than 20 MB.");
  const lib = await getPdfJs();
  const task = lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), useSystemFonts: true });
  const pdf = await task.promise;
  try {
    if (!pdf.numPages || pdf.numPages > MAX_SLIDES) throw new Error(`PDF imports support 1 to ${MAX_SLIDES} pages.`);
    const slides: Slide[] = [];
    let renderedBytes = 0;
    for (let n = 1; n <= pdf.numPages; n += 1) {
      const page = await pdf.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(STAGE_W / base.width, STAGE_H / base.height);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.ceil(viewport.width));
      canvas.height = Math.max(1, Math.ceil(viewport.height));
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("This browser could not prepare the PDF pages for import.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: context, viewport, background: "#ffffff" }).promise;
      const data = canvas.toDataURL("image/jpeg", 0.84);
      renderedBytes += Math.floor(data.length * 0.75);
      canvas.width = 0;
      canvas.height = 0;
      if (renderedBytes > MAX_RENDERED_BYTES) throw new Error("The rendered PDF pages are too large to import together. Split the PDF into smaller files.");
      const width = viewport.width;
      const height = viewport.height;
      slides.push({
        id: newId("slide"), layoutId: "blank", background: { kind: "theme", variant: "default" }, notes: `Imported from ${file.name} · page ${n}`,
        elements: [{ id: newId("el"), type: "image", src: data, alt: `PDF page ${n}`, fit: "contain", radius: 0, position: "50% 50%", overlay: 0, x: (STAGE_W - width) / 2, y: (STAGE_H - height) / 2, w: width, h: height, rotation: 0, z: 0, locked: false, opacity: 1 }],
      });
    }
    const now = new Date().toISOString();
    return { id: newId("deck"), title: file.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ") || "Imported PDF", themeId: "paper", slides, createdAt: now, updatedAt: now, meta: { source: "import" }, version: 1 };
  } finally {
    await task.destroy();
  }
}
