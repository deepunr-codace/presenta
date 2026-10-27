"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { ErrorNotice } from "@/components/ui-kit/ErrorNotice";
import { fetchAccount, type AccountProfile } from "./account-data";
import { ProfileCard } from "./ProfileCard";
import { SecurityCard } from "./SecurityCard";
import { DangerZoneCard } from "./DangerZoneCard";

/** /account: profile, password and account deletion. */
export function AccountScreen() {
  const [account, setAccount] = useState<AccountProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchAccount()
      .then((a) => alive && setAccount(a))
      .catch((err: unknown) => alive && setError(err instanceof Error ? err.message : "Could not load your account."));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <AppShell breadcrumbs={[{ label: "Studio", href: "/" }, { label: "Account" }]}>
      <div className="ps-page ps-page-narrow">
        <header className="mb-8">
          <h1 className="ps-heading">Account</h1>
          <p className="ps-body-lg mt-2">Manage your profile, password and sign-in.</p>
        </header>

        {error ? <ErrorNotice compact className="mb-4" message={error} /> : null}

        {!account && !error ? (
          <div className="flex flex-col gap-4" aria-hidden>
            <div className="ps-glass h-40 animate-pulse" />
            <div className="ps-glass h-40 animate-pulse" />
          </div>
        ) : null}

        {account ? (
          <div className="flex flex-col gap-4">
            <ProfileCard account={account} onUpdated={setAccount} />
            <SecurityCard account={account} onUpdated={setAccount} />
            <DangerZoneCard />
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
