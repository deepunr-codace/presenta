import type { Metadata } from "next";
import { AgentScreen } from "@/components/agent/AgentScreen";

export const metadata: Metadata = { title: "Agent mode", description: "Let Presenta's AI agent plan and build a deck for you, step by step." };

export default function AgentPage() {
  return <AgentScreen />;
}
