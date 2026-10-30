"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ApiError, authenticatePublicLink, claimLink, fetchPublicDeck } from "@/lib/collab";
import type { Deck } from "@/lib/deck/schema";
import { AppShell } from "@/components/shell/AppShell";
import { ErrorNotice } from "@/components/ui-kit/ErrorNotice";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { PublicDeckView } from "./PublicDeckView";

/**
 * /s/<token>: signed-in collaborators can claim a link; anyone can view it when the owner enables public access.
 */
export function ShareLinkScreen({ token, embed = false }: { token: string; embed?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [publicDeck, setPublicDeck] = useState<Deck | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [unlocking, setUnlocking] = useState(false);

  useEffect(() => {
    let alive = true;
    const openPublicDeck = async () => {
      const deck = await fetchPublicDeck(token);
      if (!alive) return;
      setPublicDeck(deck);
      setNeedsPassword(deck === null);
    };
    const openLink = async () => {
      if (embed) {
        try { await openPublicDeck(); }
        catch (err) { if (alive) setError(err instanceof Error ? err.message : "This link is not active."); }
        return;
      }
      try {
        const { deckId } = await claimLink(token);
        if (alive) router.replace(`/deck/${encodeURIComponent(deckId)}`);
      } catch (err) {
        if (!alive) return;
        if (err instanceof ApiError && (err.status === 401 || err.status === 409)) {
          try { await openPublicDeck(); }
          catch (publicError) { if (alive) setError(publicError instanceof Error ? publicError.message : "This link is not active."); }
          return;
        }
        setError(err instanceof Error ? err.message : "This link is not active.");
      }
    };
    void openLink();
    return () => {
      alive = false;
    };
  }, [token, router, embed]);

  const unlock = async (event: FormEvent) => {
    event.preventDefault();
    if (!password || unlocking) return;
    setUnlocking(true);
    setError(null);
    try {
      await authenticatePublicLink(token, password);
      const deck = await fetchPublicDeck(token);
      if (!deck) throw new Error("Enter the share password to open this link.");
      setPublicDeck(deck);
      setNeedsPassword(false);
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not unlock this presentation.");
    } finally {
      setUnlocking(false);
    }
  };

  if (publicDeck) return <PublicDeckView deck={publicDeck} token={token} embed={embed} />;

  if (needsPassword) {
    const gate = <section className="mx-auto w-full max-w-sm rounded-xl border border-[var(--ps-line)] bg-[var(--ps-paper)] p-5 text-[var(--ps-ink)] shadow-lg">
      <h1 className="text-lg font-semibold">Password protected</h1>
      <p className="ps-caption mb-4 mt-1">Enter the password provided by the owner to view this presentation.</p>
      <form className="grid gap-3" onSubmit={(event) => void unlock(event)}>
        <input className="ps-input w-full" type="password" autoComplete="current-password" autoFocus value={password} onChange={(event) => setPassword(event.target.value)} aria-label="Presentation password" placeholder="Presentation password" />
        {error ? <p className="ps-caption text-[var(--ps-danger)]" role="alert">{error}</p> : null}
        <button type="submit" className="ps-btn ps-btn-primary w-full" disabled={unlocking || !password}>{unlocking ? "Unlocking…" : "View presentation"}</button>
      </form>
    </section>;
    if (embed) return <main className="ps-public-embed-loading p-4">{gate}</main>;
    return <AppShell breadcrumbs={[{ label: "Studio", href: "/" }, { label: "Shared deck" }]}><div className="ps-page ps-page-narrow grid min-h-[55vh] place-items-center">{gate}</div></AppShell>;
  }

  if (embed) return <main className="ps-public-embed-loading" aria-busy={!error}>{error ? <p role="alert">{error}</p> : <p>Loading presentation…</p>}</main>;

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
