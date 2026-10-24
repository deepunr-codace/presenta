import type { Metadata } from "next";
import { TemplatesScreen } from "@/components/templates/TemplatesScreen";

export const metadata: Metadata = { title: "Templates · Presenta Studio" };

export default function Page() {
  return <TemplatesScreen />;
}
