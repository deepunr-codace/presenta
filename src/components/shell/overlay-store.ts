"use client";

import { create } from "zustand";

/** Open state of the search palette and the shortcuts dialog, so the sidebar and keyboard can open them from anywhere. */
export const useOverlays = create<{
  search: boolean;
  shortcuts: boolean;
  setSearch: (open: boolean) => void;
  setShortcuts: (open: boolean) => void;
}>()((set) => ({
  search: false,
  shortcuts: false,
  setSearch: (search) => set({ search }),
  setShortcuts: (shortcuts) => set({ shortcuts }),
}));
