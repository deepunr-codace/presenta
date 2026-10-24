import type { Metadata } from "next";
import { TrashScreen } from "@/components/trash/TrashScreen";

export const metadata: Metadata = { title: "Trash · Presenta Studio" };

export default function Page() {
  return <TrashScreen />;
}
