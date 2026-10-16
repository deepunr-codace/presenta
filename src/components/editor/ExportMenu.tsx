"use client";

import { DownloadSimple, FilePdf, FileText, Presentation } from "@phosphor-icons/react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ExportKind } from "./deck-export";

type Props = {
  onExport: (kind: ExportKind) => void;
  /** Greyed out until the deck is loaded. */
  disabled?: boolean;
};

/** "Export" dropdown (secondary button) with PDF (print), PowerPoint and deck JSON. */
export function ExportMenu({ onExport, disabled = false }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<button type="button" className="ps-btn" disabled={disabled} />}>
        <DownloadSimple size={12} />
        Export
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuItem onClick={() => onExport("pdf")}>
          <FilePdf /> PDF (print)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onExport("pptx")}>
          <Presentation /> PowerPoint (.pptx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onExport("json")}>
          <FileText /> Deck JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
