import type { Metadata } from "next";
import { Suspense } from "react";
import { DecksScreen } from "@/components/decks/DecksScreen";
import { LoadingState } from "@/components/ui-kit/LoadingState";

export const metadata: Metadata = { title: "Decks · Presenta Studio" };

export default function Page() {
  // The screen reads the folder from the URL, which needs a Suspense boundary.
  return (
    <Suspense fallback={<LoadingState label="Loading decks…" />}>
      <DecksScreen />
    </Suspense>
  );
}
