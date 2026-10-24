import type { Metadata } from "next";
import { LabsScreen } from "@/components/labs/LabsScreen";

export const metadata: Metadata = { title: "Labs · Presenta Studio" };

export default function Page() {
  return <LabsScreen />;
}
