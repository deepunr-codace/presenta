import { create } from "zustand";

/** UI-only state shared by the editor toolbar and the right sidebar. */

export type SidebarTab = "assistant" | "design" | "details";

type SidebarState = {
  open: boolean;
  tab: SidebarTab;
  setOpen: (open: boolean) => void;
  setTab: (tab: SidebarTab) => void;
  /** Open the sidebar on `tab`, or close it when it is already showing that tab. */
  toggle: (tab: SidebarTab) => void;
};

export const useSidebarStore = create<SidebarState>()((set, get) => ({
  open: false,
  tab: "assistant",
  setOpen: (open) => set({ open }),
  setTab: (tab) => set({ tab, open: true }),
  toggle: (tab) => {
    const s = get();
    if (s.open && s.tab === tab) set({ open: false });
    else set({ open: true, tab });
  },
}));
