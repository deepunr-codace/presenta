"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { claimLink } from "@/lib/collab";
import { AppShell } from "@/components/shell/AppShell";
import { ErrorNotice } from "@/components/ui-kit/ErrorNotice";
import { LoadingState } from "@/components/ui-kit/LoadingState";

/**
 * /s/<token>: a share link. The visitor must be signed in (the app's sign-in gate sends them to log in and back here).
 * If the owner has the link set to "anyone with the link can view", the deck opens for viewing and joins their
 * "Shared with me" list; otherwise they are told the link is not active.
 */
export function ShareLinkScreen({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    claimLink(token)
      .then(({ deckId }) => alive && router.replace(`/deck/${encodeURIComponent(deckId)}`))
      .catch((err: unknown) => alive && setError(err instanceof Error ? err.message : "This link is not active."));
    return () => {
      alive = false;
    };
  }, [token, router]);

  return (
    <AppShell breadcrumbs={[{ label: "Studio", href: "/" }, { label: "Shared deck" }]}>
      <div className="ps-page ps-page-narrow">
        {error ? (
          <>
            <ErrorNotice className="mb-4" message={error} />
            <Link href="/" className="ps-btn">
              Back to Studio
            </Link>
          </>
        ) : (
          <LoadingState label="Opening the shared deck…" />
        )}
      </div>
    </AppShell>
  );
}
