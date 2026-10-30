import type { Metadata } from "next";
import { CoachScreen } from "@/components/coach/CoachScreen";

export const metadata: Metadata = { title: "Presenter coach · Presenta Studio" };

export default async function CoachPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CoachScreen id={id} />;
}
