import { Suspense } from "react";
import { DeckShell } from "@/components/editor/DeckShell";
import { EditorScreen } from "@/components/editor/EditorScreen";

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
