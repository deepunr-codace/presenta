"use client";

import { create } from "zustand";

/** Open state of the API key dialog, so the sidebar, the banner and the prompt pill can all open it. */
export const useApiKeyDialog = create<{ open: boolean; setOpen: (open: boolean) => void }>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
