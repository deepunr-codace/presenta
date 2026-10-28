import type { Metadata } from "next";
import { TeamsScreen } from "@/components/teams/TeamsScreen";

export const metadata: Metadata = { title: "Teams · Presenta Studio" };

export default function Page() {
  return <TeamsScreen />;
}
