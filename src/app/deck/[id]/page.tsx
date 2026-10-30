import type { Metadata } from "next";
import { DeckShell } from "@/components/editor/DeckShell";
import { ReviewScreen } from "@/components/review/ReviewScreen";

export const metadata: Metadata = {
  title: "Review deck",
  description: "Preview and review this deck before you share or present it.",
  robots: { index: false, follow: false },
};

export default async function DeckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <DeckShell id={id}>
      <ReviewScreen id={id} />
    </DeckShell>
  );
}
