"use client";

import Link from "next/link";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { HardDrives, ShieldCheck, Sparkle, Trash, User, UsersThree, Palette, Database, Wrench, type IconProps } from "@phosphor-icons/react";
import { AppShell } from "@/components/shell/AppShell";
import { ErrorNotice } from "@/components/ui-kit/ErrorNotice";
import { AiUsageCard } from "@/components/settings/AiUsageCard";
import { AppearanceCard } from "@/components/settings/AppearanceCard";
import { DataCard } from "@/components/settings/DataCard";
import { StorageCard } from "@/components/settings/StorageCard";
import { TeamsCard } from "@/components/settings/TeamsCard";
import { fetchAccount, type AccountProfile } from "./account-data";
import { ProfileCard } from "./ProfileCard";
import { SecurityCard } from "./SecurityCard";
import { DangerZoneCard } from "./DangerZoneCard";

type Icon = ComponentType<IconProps>;

type Section = { id: string; label: string; icon: Icon; admin?: boolean };

const SECTIONS: Section[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "storage", label: "Storage", icon: HardDrives },
  { id: "ai", label: "AI", icon: Sparkle },
  { id: "teams", label: "Teams", icon: UsersThree },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "data", label: "Your data", icon: Database },
  { id: "admin", label: "Admin", icon: Wrench, admin: true },
  { id: "danger", label: "Delete account", icon: Trash },
];

/** An anchor target for the section menu. */
function Block({ id, className, children }: { id: string; className?: string; children: ReactNode }) {
  return (
    <div id={id} className={`scroll-mt-6 ${className ?? ""}`}>
      {children}
    </div>
  );
}

/**
 * Settings (at /account): a full-width page with a section menu on the left and the cards in a two-column grid.
 * Profile, storage, AI allowance, teams, appearance, password, backups and account deletion in one place.
 */
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

  const sections = SECTIONS.filter((s) => !s.admin || account?.isAdmin);

  return (
    <AppShell breadcrumbs={[{ label: "Studio", href: "/" }, { label: "Settings" }]}>
      <div className="ps-page">
        <header className="ps-page-hero mb-8">
          <h1 className="ps-heading">Settings</h1>
          <p className="ps-body-lg mt-2">Your profile, storage, AI, teams and security, all in one place.</p>
        </header>

        {error ? <ErrorNotice compact className="mb-4" message={error} /> : null}

        {!account && !error ? (
          <div className="grid gap-5 lg:grid-cols-2" aria-hidden>
            <div className="ps-glass h-48 animate-pulse" />
            <div className="ps-glass h-48 animate-pulse" />
            <div className="ps-glass h-48 animate-pulse" />
            <div className="ps-glass h-48 animate-pulse" />
          </div>
        ) : null}

        {account ? (
          <div className="grid gap-8 lg:grid-cols-[210px_minmax(0,1fr)]">
            <nav aria-label="Settings sections" className="lg:sticky lg:top-6 lg:self-start">
              <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
                {sections.map((s) => (
                  <li key={s.id} className="shrink-0">
                    <a href={`#${s.id}`} className="ps-panel-row whitespace-nowrap">
                      <s.icon size={18} weight="light" aria-hidden />
                      <span>{s.label}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="grid min-w-0 gap-5 xl:grid-cols-2">
              <Block id="profile" className="xl:col-span-2">
                <ProfileCard account={account} onUpdated={setAccount} />
              </Block>
              <Block id="storage" className="xl:col-span-2">
                <StorageCard />
              </Block>
              <Block id="ai">
                <AiUsageCard />
              </Block>
              <Block id="teams">
                <TeamsCard />
              </Block>
              <Block id="appearance">
                <AppearanceCard />
              </Block>
              <Block id="data">
                <DataCard />
              </Block>
              <Block id="security" className="xl:col-span-2">
                <SecurityCard account={account} onUpdated={setAccount} />
              </Block>
              {account.isAdmin ? (
                <Block id="admin" className="xl:col-span-2">
                  <section className="ps-glass" data-paper>
                    <h2 className="ps-cardtitle">Admin</h2>
                    <p className="ps-body mt-1">See every user and their usage, and manage the AI keys, model and daily allowance behind Presenta Studio.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link href="/admin/users" className="ps-btn ps-btn-xs inline-flex">
                        Users and usage
                      </Link>
                      <Link href="/admin/ai" className="ps-btn ps-btn-xs inline-flex">
                        Presenta Studio settings
                      </Link>
                    </div>
                  </section>
                </Block>
              ) : null}
              <Block id="danger" className="xl:col-span-2">
                <DangerZoneCard />
              </Block>
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
