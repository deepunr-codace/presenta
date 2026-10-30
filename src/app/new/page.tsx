import type { Metadata } from "next";
import { Wizard } from "@/components/wizard/Wizard";

export const metadata: Metadata = {
  title: "New deck",
  description: "Describe a deck in plain language and watch it build itself, or start from your own content.",
  robots: { index: false, follow: false },
};

export default function NewDeckPage() {
  return <Wizard />;
}
