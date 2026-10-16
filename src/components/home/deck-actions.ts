import type { DeckSummary } from "@/lib/persist";

export type DeckActions = {
  onOpen: (id: string) => void;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onExport: (id: string) => void;
  onDelete: (summary: DeckSummary) => void;
};
