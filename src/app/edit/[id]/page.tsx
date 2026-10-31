import { Suspense } from "react";
import type { Metadata } from "next";
import { DeckShell } from "@/components/editor/DeckShell";
import { EditorScreen } from "@/components/editor/EditorScreen";
import { resolveDeckRouteId } from "@/lib/deck/resolve-route";

export const metadata: Metadata = {
  title: "Editor",
  description: "Edit every slide: text, layout, theme and brand.",
  robots: { index: false, follow: false },
};

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idOrSlug } = await params;
  const id = await resolveDeckRouteId(idOrSlug);
  // EditorScreen reads `?slide=` with useSearchParams, which needs a Suspense boundary.
  return (
    <DeckShell id={id} crumbs={false}>
      <Suspense fallback={null}>
        <EditorScreen id={id} />
      </Suspense>
    </DeckShell>
  );
}
