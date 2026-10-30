import type { Metadata } from "next";
import { AnalyticsScreen } from "@/components/analytics/AnalyticsScreen";

export const metadata: Metadata = { title: "Analytics", description: "See how your decks perform: views, reading time and engagement." };

export default function Page() {
  return <AnalyticsScreen />;
}
