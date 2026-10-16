import type { Metadata } from "next";
import { PresentScreen } from "@/components/present/PresentScreen";

export const metadata: Metadata = { title: "Present · Presenta Studio" };

export default async function PresentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PresentScreen id={id} />;
}
