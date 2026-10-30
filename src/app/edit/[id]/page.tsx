import { Suspense } from "react";
import type { Metadata } from "next";
import { DeckShell } from "@/components/editor/DeckShell";
import { EditorScreen } from "@/components/editor/EditorScreen";

export const metadata: Metadata = {
  title: "Editor",
  description: "Edit every slide: text, layout, theme and brand.",
  robots: { index: false, follow: false },
};

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // EditorScreen reads `?slide=` with useSearchParams, which needs a Suspense boundary.
  return (
    <DeckShell id={id}>
      <Suspense fallback={null}>
        <EditorScreen id={id} />
      </Suspense>
    </DeckShell>
  );
}
