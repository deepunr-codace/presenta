"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { acceptInvite, declineInvite, fetchInvite, type InvitePreview } from "@/lib/collab";
import { AppShell } from "@/components/shell/AppShell";
import { ErrorNotice } from "@/components/ui-kit/ErrorNotice";
import { LoadingState } from "@/components/ui-kit/LoadingState";

/** /invite/<token>: the page an invitation link opens. Only the account the invitation was sent to can join. */
export function InviteScreen({ token }: { token: string }) {
  const router = useRouter();
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchInvite(token)
      .then((i) => alive && setInvite(i))
      .catch((err: unknown) => alive && setError(err instanceof Error ? err.message : "This invitation is no longer valid."));
    return () => {
      alive = false;
    };
  }, [token]);

  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      await acceptInvite(token);
      router.push("/teams");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join the team.");
      setBusy(false);
    }
  };

  const decline = async () => {
    setBusy(true);
    try {
      await declineInvite(token);
      router.push("/teams");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not decline the invitation.");
      setBusy(false);
    }
  };

  return (
    <AppShell breadcrumbs={[{ label: "Studio", href: "/" }, { label: "Teams", href: "/teams" }, { label: "Invitation" }]}>
      <div className="ps-page ps-page-narrow">
        {!invite && !error ? <LoadingState label="Opening the invitation…" /> : null}
        {error ? <ErrorNotice compact className="mb-4" message={error} /> : null}
        {invite ? (
          <section className="ps-glass" data-paper>
            <h1 className="ps-heading">Join {invite.teamName}?</h1>
            <p className="ps-body-lg mt-2">
              {invite.invitedBy} invited <strong>{invite.email}</strong> to this team. Members can open the decks the team has been given access to.
            </p>
            {!invite.forYou ? <p className="ps-caption mt-3" style={{ color: "var(--ps-danger)" }}>You are signed in as a different account. Sign in with {invite.email} to join.</p> : null}
            <div className="mt-5 flex gap-2">
              <button type="button" className="ps-btn ps-btn-primary" onClick={() => void join()} disabled={busy || !invite.forYou}>
                Join team
              </button>
              <button type="button" className="ps-btn" onClick={() => void decline()} disabled={busy || !invite.forYou}>
                Decline
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
