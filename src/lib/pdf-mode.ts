"use client";

import { create } from "zustand";

/** How a PDF becomes a deck: the standard converter in the browser, or Smart convert with AI. */
export type PdfMode = "standard" | "smart";

type PdfModeState = { fileName: string | null; resolve: ((mode: PdfMode | null) => void) | null };

export const usePdfModeStore = create<PdfModeState>(() => ({ fileName: null, resolve: null }));

/** Smart convert is hidden for now: every PDF uses the standard converter and no question is asked. */
const SMART_CONVERT_ENABLED = false;

/** Ask how to convert a PDF. Resolves null when the person cancels. Other files resolve "standard" at once. */
export function askPdfMode(file: File): Promise<PdfMode | null> {
  if (!SMART_CONVERT_ENABLED) return Promise.resolve("standard");
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
