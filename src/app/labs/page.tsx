import type { Metadata } from "next";
import { LabsScreen } from "@/components/labs/LabsScreen";

export const metadata: Metadata = { title: "Labs", description: "Early and experimental Presenta Studio features." };

export default function Page() {
  return <LabsScreen />;
}
