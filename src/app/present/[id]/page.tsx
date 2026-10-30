import type { Metadata } from "next";
import { PresentScreen } from "@/components/present/PresentScreen";
import { resolveDeckRouteId } from "@/lib/deck/resolve-route";

export const metadata: Metadata = {
  title: "Present",
  description: "Full-screen presentation mode for your deck.",
  robots: { index: false, follow: false },
};

export default async function PresentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PresentScreen id={await resolveDeckRouteId(id)} />;
}
