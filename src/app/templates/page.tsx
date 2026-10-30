import type { Metadata } from "next";
import { Suspense } from "react";
import { TemplatesScreen } from "@/components/templates/TemplatesScreen";
import { LoadingState } from "@/components/ui-kit/LoadingState";

export const metadata: Metadata = { title: "Templates · Presenta Studio" };

export default function Page() {
  // The screen reads the category from the URL, which needs a Suspense boundary.
  return (
    <Suspense fallback={<LoadingState label="Loading templates…" />}>
      <TemplatesScreen />
    </Suspense>
  );
}
