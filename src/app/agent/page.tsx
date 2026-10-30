import type { Metadata } from "next";
import { AgentScreen } from "@/components/agent/AgentScreen";

export const metadata: Metadata = { title: "Agent mode · Presenta Studio" };

export default function AgentPage() {
  return <AgentScreen />;
}
