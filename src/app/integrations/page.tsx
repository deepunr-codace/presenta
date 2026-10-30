import type { Metadata } from "next";
import { IntegrationsScreen } from "@/components/integrations/IntegrationsScreen";

export const metadata: Metadata = { title: "Integrations", description: "Connect Presenta Studio to the other tools in your workflow." };

export default function Page() {
  return <IntegrationsScreen />;
}
