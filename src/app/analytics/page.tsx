import type { Metadata } from "next";
import { AnalyticsScreen } from "@/components/analytics/AnalyticsScreen";

export const metadata: Metadata = { title: "Analytics · Presenta Studio" };

export default function Page() {
  return <AnalyticsScreen />;
}
