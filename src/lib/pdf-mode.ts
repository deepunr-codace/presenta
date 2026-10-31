"use client";

import { create } from "zustand";

/** How a PDF becomes a deck: the standard converter in the browser, or Smart convert with AI. */
export type PdfMode = "standard" | "smart";

type PdfModeState = { fileName: string | null; resolve: ((mode: PdfMode | null) => void) | null };

export const usePdfModeStore = create<PdfModeState>(() => ({ fileName: null, resolve: null }));

/** Ask how to convert a PDF. Resolves null when the person cancels. Other files resolve "standard" at once. */
export function askPdfMode(file: File): Promise<PdfMode | null> {
  if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") return Promise.resolve("standard");
  return new Promise((resolve) => {
    usePdfModeStore.getState().resolve?.(null);
    usePdfModeStore.setState({ fileName: file.name, resolve });
  });
}

export function answerPdfMode(mode: PdfMode | null): void {
  const { resolve } = usePdfModeStore.getState();
  usePdfModeStore.setState({ fileName: null, resolve: null });
  resolve?.(mode);
}
