import type { Metadata } from "next";
import { TrashScreen } from "@/components/trash/TrashScreen";

export const metadata: Metadata = { title: "Trash", description: "Deleted decks wait here for 30 days before they're gone for good." };

export default function Page() {
  return <TrashScreen />;
}
