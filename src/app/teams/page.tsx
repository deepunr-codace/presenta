import type { Metadata } from "next";
import { TeamsScreen } from "@/components/teams/TeamsScreen";

export const metadata: Metadata = { title: "Teams", description: "Invite teammates, manage roles and share decks across your workspace." };

export default function Page() {
  return <TeamsScreen />;
}
