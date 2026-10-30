import type { Metadata } from "next";
import { CoachScreen } from "@/components/coach/CoachScreen";
import { resolveDeckRouteId } from "@/lib/deck/resolve-route";

export const metadata: Metadata = {
  title: "Presenter coach",
  description: "Rehearse your deck with live feedback on pacing, clarity and filler words.",
  robots: { index: false, follow: false },
};

export default async function CoachPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CoachScreen id={await resolveDeckRouteId(id)} />;
}
