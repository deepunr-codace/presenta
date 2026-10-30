import type { Metadata } from "next";
import { DeckShell } from "@/components/editor/DeckShell";
import { ReviewScreen } from "@/components/review/ReviewScreen";
import { resolveDeckRouteId } from "@/lib/deck/resolve-route";

export const metadata: Metadata = {
  title: "Review deck",
  description: "Preview and review this deck before you share or present it.",
  robots: { index: false, follow: false },
};

export default async function DeckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idOrSlug } = await params;
  const id = await resolveDeckRouteId(idOrSlug);
  return (
    <DeckShell id={id}>
      <ReviewScreen id={id} />
    </DeckShell>
  );
}
