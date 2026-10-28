import type { Metadata } from "next";
import { IntegrationsScreen } from "@/components/integrations/IntegrationsScreen";

export const metadata: Metadata = { title: "Integrations · Presenta Studio" };

export default function Page() {
  return <IntegrationsScreen />;
}
