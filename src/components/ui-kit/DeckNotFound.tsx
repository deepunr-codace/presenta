import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  className?: string;
};

/** Empty state for a deck id that is not in the signed-in account. */
export function DeckNotFound({ id, className }: Props) {
  return (
    <div className={cn("flex h-full min-h-[60vh] items-center justify-center p-6", className)}>
      <div className="ps-glass w-full max-w-sm">
        <h1 className="ps-cardtitle">Deck not found</h1>
        <p className="ps-body mt-1">
          No deck with id <code className="rounded-[var(--ps-r-sm)] bg-[var(--ps-plate)] px-1 py-0.5 text-[11px]">{id}</code> is saved in your account.
        </p>
        <Link href="/" className="ps-btn ps-btn-xs mt-4 inline-flex">
          <ArrowLeft size={12} /> Back to decks
        </Link>
      </div>
    </div>
  );
}
