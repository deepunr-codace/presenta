"use client";

import Link from "next/link";
import { useSyncExternalStore, type ReactNode } from "react";
import { BellRinging, CheckCircle, DownloadSimple, GoogleLogo, Sparkle, UsersThree } from "@phosphor-icons/react";
import { LABS_EVENT, getLabsRaw, parseLabs, toggleLabsInterest } from "@/lib/labs-interest";
import { useAiHealth } from "@/hooks/useAiHealth";
import { AppShell } from "@/components/shell/AppShell";
import { useApiKeyDialog } from "@/components/shell/api-key-dialog-store";
import { useToast } from "@/components/shell/Toast";
import { SectionTitle } from "@/components/ui-kit/SectionTitle";

function subscribe(onChange: () => void): () => void {
  window.addEventListener(LABS_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(LABS_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

const UPCOMING = [
  { id: "integration-gdrive", name: "Google Drive", note: "Save and open decks straight from Drive." },
  { id: "integration-slack", name: "Slack", note: "Post a deck, and get told when someone opens it." },
  { id: "integration-notion", name: "Notion", note: "Turn pages into decks, and embed decks in pages." },
  { id: "integration-zapier", name: "Zapier", note: "Connect decks to thousands of other apps." },
];

function Card({ icon, title, status, children }: { icon: ReactNode; title: string; status?: ReactNode; children: ReactNode }) {
  return (
    <section className="ps-glass flex flex-col gap-3" data-paper>
      <div className="flex items-center gap-2">
        <span className="text-[var(--ps-ink)]" aria-hidden>
          {icon}
        </span>
        <h3 className="ps-cardtitle">{title}</h3>
        {status ? <span className="ml-auto">{status}</span> : null}
      </div>
      {children}
    </section>
  );
}

/** /integrations: what is connected today (AI, sign-in, exports) and what is coming, with a way to say which you want first. */
export function IntegrationsScreen() {
  const { toast } = useToast();
  const health = useAiHealth();
  const openKeyDialog = useApiKeyDialog((s) => s.setOpen);
  const wanted = parseLabs(useSyncExternalStore(subscribe, getLabsRaw, () => null));

  const toggle = (id: string, name: string) => {
    try {
      const next = toggleLabsInterest(id);
      toast(next.includes(id) ? `We will let you know when ${name} is ready.` : `Okay, no notification for ${name}.`, { tone: "success" });
    } catch {
      toast("Could not save that in this browser.", { tone: "error" });
    }
  };

  const aiName = !health ? "Checking…" : health.byok ? "Your own API key" : health.provider === "presenta" ? "Presenta AI" : health.hasKey ? health.model : "Not connected";

  return (
    <AppShell active="integrations" sidebar="full" breadcrumbs={[{ label: "Studio", href: "/" }, { label: "Integrations" }]}>
      <div className="ps-page">
        <header className="mb-8">
          <h1 className="ps-heading">Integrations</h1>
          <p className="ps-body-lg mt-2">Connect Presenta to the tools you already use.</p>
        </header>

        <SectionTitle title="Connected" className="mb-4" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Card icon={<Sparkle size={22} weight="light" />} title="AI" status={<span className="ps-pill"><CheckCircle size={12} /> {health?.hasKey ? "Connected" : "Offline"}</span>}>
            <p className="ps-body">{aiName}</p>
            <p className="ps-caption">Presenta AI is free with your account. Add your own key to remove the daily limit.</p>
            <button type="button" className="ps-btn ps-btn-xs self-start" onClick={() => openKeyDialog(true)}>
              {health?.byok ? "Change my API key" : "Use my own API key"}
            </button>
          </Card>

          <Card icon={<GoogleLogo size={22} weight="light" />} title="Google sign-in" status={<span className="ps-pill"><CheckCircle size={12} /> Available</span>}>
            <p className="ps-body">Sign in with Google using the same email as your account.</p>
            <p className="ps-caption">Manage your password and sign-in details in Settings.</p>
            <Link href="/account#security" className="ps-btn ps-btn-xs self-start">
              Open security settings
            </Link>
          </Card>

          <Card icon={<UsersThree size={22} weight="light" />} title="Teams and sharing" status={<span className="ps-pill"><CheckCircle size={12} /> On</span>}>
            <p className="ps-body">Share decks with people, teams, or anyone with a link.</p>
            <p className="ps-caption">Invitations are links you send yourself. No email is sent.</p>
            <Link href="/teams" className="ps-btn ps-btn-xs self-start">
              Manage teams
            </Link>
          </Card>

          <Card icon={<DownloadSimple size={22} weight="light" />} title="Export" status={<span className="ps-pill"><CheckCircle size={12} /> Built in</span>}>
            <p className="ps-body">Download any deck as PowerPoint, PDF, or JSON from the deck&apos;s Export menu.</p>
            <p className="ps-caption">Back up every deck at once from Settings.</p>
            <Link href="/account#data" className="ps-btn ps-btn-xs self-start">
              Back up my decks
            </Link>
          </Card>
        </div>

        <SectionTitle title="Coming next" caption="Tell us which ones you want first" className="mb-4 mt-10" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {UPCOMING.map((u) => {
            const on = wanted.includes(u.id);
            return (
              <section key={u.id} className="ps-glass flex flex-col gap-2" data-paper>
                <h3 className="ps-cardtitle">{u.name}</h3>
                <p className="ps-caption">{u.note}</p>
                <button type="button" className={`ps-btn ps-btn-xs mt-auto self-start ${on ? "ps-btn-primary" : ""}`} aria-pressed={on} onClick={() => toggle(u.id, u.name)}>
                  <BellRinging size={12} /> {on ? "You will be notified" : "Notify me"}
                </button>
              </section>
            );
          })}
        </div>
        <p className="ps-caption mt-6">These need each service&apos;s approval before they can connect, so there is no date yet. Your choice is saved in this browser.</p>
      </div>
    </AppShell>
  );
}
