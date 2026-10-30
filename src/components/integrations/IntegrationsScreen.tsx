"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { BellRinging, CheckCircle, ChatCircleDots, DownloadSimple, FileText, GoogleLogo, Sparkle, UsersThree } from "@phosphor-icons/react";
import { LABS_EVENT, getLabsRaw, parseLabs, toggleLabsInterest } from "@/lib/labs-interest";
import { useAiHealth } from "@/hooks/useAiHealth";
import { AppShell } from "@/components/shell/AppShell";
import { useApiKeyDialog } from "@/components/shell/api-key-dialog-store";
import { useToast } from "@/components/shell/Toast";
import { disconnectGoogleDrive, fetchGoogleDriveBackups, fetchGoogleDriveStatus, fetchNotionStatus, fetchSlackStatus, fetchZapierStatus, readGoogleDriveBackup, saveDeckToGoogleDrive, saveNotionToken, saveSlackWebhook, saveZapierHook, type GoogleDriveBackup } from "@/lib/collab";
import { importDeckFile, saveDeck } from "@/lib/persist";
import { SectionTitle } from "@/components/ui-kit/SectionTitle";

function subscribe(onChange: () => void): () => void {
  window.addEventListener(LABS_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(LABS_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

type UpcomingIntegration = { id: string; name: string; note: string };
const UPCOMING: UpcomingIntegration[] = [
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

function SlackCard() {
  const { toast } = useToast();
  const [connected, setConnected] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchSlackStatus().then((result) => { if (alive) setConnected(result.connected); }).catch((e: unknown) => { if (alive) setError(e instanceof Error ? e.message : "Could not check Slack."); }).finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await saveSlackWebhook(url);
      setConnected(result.connected);
      setUrl("");
      toast("Slack is connected. You can post decks from a deck's Share actions.", { tone: "success" });
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save the Slack connection."); }
    finally { setBusy(false); }
  };

  const disconnect = async () => {
    setBusy(true);
    setError(null);
    try { await saveSlackWebhook(null); setConnected(false); toast("Slack disconnected.", { tone: "success" }); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not disconnect Slack."); }
    finally { setBusy(false); }
  };

  return <Card icon={<ChatCircleDots size={22} weight="light" />} title="Slack" status={<span className="ps-pill"><CheckCircle size={12} /> {loaded ? connected ? "Connected" : "Not connected" : "Checking…"}</span>}>
    <p className="ps-body">Post a deck link to a Slack channel using an incoming webhook.</p>
    <p className="ps-caption">The webhook is encrypted in your account and never shown after saving. Create one in Slack’s app settings.</p>
    <form className="flex w-full flex-col gap-2" onSubmit={(e) => void save(e)}>
      <label className="sr-only" htmlFor="slack-webhook">Slack incoming webhook URL</label>
      <input id="slack-webhook" type="url" className="ps-input w-full" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={connected ? "Replace saved webhook URL…" : "https://hooks.slack.com/services/…"} autoComplete="off" />
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="ps-btn ps-btn-xs" disabled={busy || !url.trim()}>{busy ? "Saving…" : connected ? "Replace webhook" : "Connect Slack"}</button>
        {connected ? <button type="button" className="ps-btn ps-btn-xs" disabled={busy} onClick={() => void disconnect()}>Disconnect</button> : null}
      </div>
    </form>
    {error ? <p className="ps-caption" role="alert" style={{ color: "var(--ps-danger)" }}>{error}</p> : null}
  </Card>;
}

function ZapierCard() {
  const { toast } = useToast();
  const [connected, setConnected] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchZapierStatus().then((r) => { if (alive) setConnected(r.connected); }).catch((e: unknown) => { if (alive) setError(e instanceof Error ? e.message : "Could not check Zapier."); }).finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { const result = await saveZapierHook(url); setConnected(result.connected); setUrl(""); toast("Zapier connected.", { tone: "success" }); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not save the Zapier connection."); }
    finally { setBusy(false); }
  };

  const disconnect = async () => {
    setBusy(true); setError(null);
    try { await saveZapierHook(null); setConnected(false); toast("Zapier disconnected.", { tone: "success" }); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not disconnect Zapier."); }
    finally { setBusy(false); }
  };

  return <Card icon={<ChatCircleDots size={22} weight="light" />} title="Zapier" status={<span className="ps-pill"><CheckCircle size={12} /> {loaded ? connected ? "Connected" : "Not connected" : "Checking…"}</span>}>
    <p className="ps-body">Send a deck to a Zapier Catch Hook to start an automation.</p>
    <p className="ps-caption">When triggered from a deck, Zapier receives the full deck JSON and a view link. The hook URL is encrypted in your account.</p>
    <form className="flex w-full flex-col gap-2" onSubmit={(e) => void save(e)}>
      <label className="sr-only" htmlFor="zapier-hook">Zapier Catch Hook URL</label>
      <input id="zapier-hook" type="url" className="ps-input w-full" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={connected ? "Replace saved Catch Hook URL…" : "https://hooks.zapier.com/hooks/catch/…"} autoComplete="off" />
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="ps-btn ps-btn-xs" disabled={busy || !url.trim()}>{busy ? "Saving…" : connected ? "Replace hook" : "Connect Zapier"}</button>
        {connected ? <button type="button" className="ps-btn ps-btn-xs" disabled={busy} onClick={() => void disconnect()}>Disconnect</button> : null}
      </div>
    </form>
    {error ? <p className="ps-caption" role="alert" style={{ color: "var(--ps-danger)" }}>{error}</p> : null}
  </Card>;
}

function NotionCard() {
  const { toast } = useToast();
  const [connected, setConnected] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetchNotionStatus().then((r) => { if (alive) setConnected(r.connected); }).catch((e: unknown) => { if (alive) setError(e instanceof Error ? e.message : "Could not check Notion."); }).finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, []);
  const save = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    try { const r = await saveNotionToken(token); setConnected(r.connected); setToken(""); toast("Notion is connected. Import pages from the deck brief.", { tone: "success" }); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not save the Notion connection."); }
    finally { setBusy(false); }
  };
  const disconnect = async () => {
    setBusy(true); setError(null);
    try { await saveNotionToken(null); setConnected(false); toast("Notion disconnected.", { tone: "success" }); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not disconnect Notion."); }
    finally { setBusy(false); }
  };
  return <Card icon={<FileText size={22} weight="light" />} title="Notion" status={<span className="ps-pill"><CheckCircle size={12} /> {loaded ? connected ? "Connected" : "Not connected" : "Checking…"}</span>}>
    <p className="ps-body">Import text from pages shared with a Notion integration into a deck brief.</p>
    <p className="ps-caption">Create an internal integration in Notion, then share the pages you want it to read. The token is encrypted in your account.</p>
    <a className="ps-link text-[13px]" href="https://www.notion.so/my-integrations" target="_blank" rel="noreferrer">Open Notion integrations</a>
    <form className="flex w-full flex-col gap-2" onSubmit={(e) => void save(e)}>
      <label className="sr-only" htmlFor="notion-token">Notion integration token</label>
      <input id="notion-token" type="password" className="ps-input w-full" value={token} onChange={(e) => setToken(e.target.value)} placeholder={connected ? "Replace saved token…" : "Paste internal integration token"} autoComplete="new-password" />
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="ps-btn ps-btn-xs" disabled={busy || !token.trim()}>{busy ? "Checking…" : connected ? "Replace token" : "Connect Notion"}</button>
        {connected ? <button type="button" className="ps-btn ps-btn-xs" disabled={busy} onClick={() => void disconnect()}>Disconnect</button> : null}
      </div>
    </form>
    {error ? <p className="ps-caption" role="alert" style={{ color: "var(--ps-danger)" }}>{error}</p> : null}
  </Card>;
}

function GoogleDriveCard() {
  const router = useRouter();
  const { toast } = useToast();
  const [connected, setConnected] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [files, setFiles] = useState<GoogleDriveBackup[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshFiles = async () => {
    const rows = await fetchGoogleDriveBackups();
    setFiles(rows);
  };
  useEffect(() => {
    let alive = true;
    fetchGoogleDriveStatus().then(async (result) => {
      if (!alive) return;
      setConnected(result.connected);
      if (result.connected) {
        try { const rows = await fetchGoogleDriveBackups(); if (alive) setFiles(rows); }
        catch (e) { if (alive) setError(e instanceof Error ? e.message : "Could not load Drive backups."); }
      }
    }).catch((e: unknown) => { if (alive) setError(e instanceof Error ? e.message : "Could not check Google Drive."); }).finally(() => { if (alive) setLoaded(true); });
    const outcome = new URLSearchParams(window.location.search).get("drive");
    if (outcome === "failed" || outcome === "invalid-state" || outcome === "signin-required") setError(new URLSearchParams(window.location.search).get("drive_error") ?? (outcome === "signin-required" ? "Sign in before connecting Google Drive." : "Google Drive could not be connected. Try again."));
    return () => { alive = false; };
  }, []);

  const connect = () => { window.location.assign("/api/integrations/google-drive/connect"); };
  const disconnect = async () => {
    setBusy(true); setError(null);
    try { await disconnectGoogleDrive(); setConnected(false); setFiles([]); toast("Google Drive disconnected.", { tone: "success" }); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not disconnect Google Drive."); }
    finally { setBusy(false); }
  };
  const restore = async (file: GoogleDriveBackup) => {
    setBusy(true); setError(null);
    try {
      const backup = await readGoogleDriveBackup(file.id);
      const deck = await importDeckFile(new File([backup.content], backup.name, { type: "application/json" }));
      await saveDeck(deck);
      toast("Deck restored from Google Drive.", { tone: "success" });
      router.push(`/deck/${encodeURIComponent(deck.id)}`);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not restore that deck."); }
    finally { setBusy(false); }
  };

  return <Card icon={<GoogleLogo size={22} weight="light" />} title="Google Drive" status={<span className="ps-pill"><CheckCircle size={12} /> {loaded ? connected ? "Connected" : "Not connected" : "Checking…"}</span>}>
    <p className="ps-body">Save a Presenta JSON backup to your Drive and restore it later from this account.</p>
    <p className="ps-caption">Drive access is requested only when you connect. Presenta saves and restores its own JSON backups; import Google Slides from the new-deck wizard. Configure the OAuth callback and Picker settings shown in .env.example.</p>
    <div className="flex flex-wrap gap-2">
      {connected ? <button type="button" className="ps-btn ps-btn-xs" disabled={busy} onClick={() => void refreshFiles().catch((e: unknown) => setError(e instanceof Error ? e.message : "Could not refresh Drive backups."))}>Refresh backups</button> : <button type="button" className="ps-btn ps-btn-xs" disabled={!loaded || busy} onClick={connect}>Connect Google Drive</button>}
      {connected ? <button type="button" className="ps-btn ps-btn-xs" disabled={busy} onClick={() => void disconnect()}>Disconnect</button> : null}
    </div>
    {connected ? <div className="max-h-44 overflow-y-auto border-t border-[var(--ps-line)] pt-2">
      {files.length ? <ul className="grid gap-1">{files.map((file) => <li key={file.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
        <span className="min-w-0 flex-1 truncate text-[13px]" title={file.name}>{file.name}</span>
        <button type="button" className="ps-btn ps-btn-xs" disabled={busy} onClick={() => void restore(file)}>Restore</button>
      </li>)}</ul> : <p className="ps-caption py-2">No Presenta backups found in Drive yet. Save one from a deck&apos;s actions.</p>}
    </div> : null}
    {error ? <p className="ps-caption" role="alert" style={{ color: "var(--ps-danger)" }}>{error}</p> : null}
  </Card>;
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

  const aiName = !health ? "Checking…" : health.byok ? "Your own API key" : health.provider === "presenta" ? "Presenta Studio" : health.hasKey ? health.model : "Not connected";

  return (
    <AppShell active="integrations" sidebar="full" breadcrumbs={[{ label: "Studio", href: "/" }, { label: "Integrations" }]}>
      <div className="ps-page">
        <header className="ps-page-hero mb-8">
          <h1 className="ps-heading">Integrations</h1>
          <p className="ps-body-lg mt-2">Connect Presenta to the tools you already use.</p>
        </header>

        <SectionTitle title="Connected" className="mb-4" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Card icon={<Sparkle size={22} weight="light" />} title="AI" status={<span className="ps-pill"><CheckCircle size={12} /> {health?.hasKey ? "Connected" : "Offline"}</span>}>
            <p className="ps-body">{aiName}</p>
            <p className="ps-caption">Presenta Studio is free with your account. Add your own key to remove the daily limit.</p>
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
          <GoogleDriveCard />
          <SlackCard />
          <ZapierCard />
          <NotionCard />
        </div>

        {UPCOMING.length ? <><SectionTitle title="Coming next" caption="Tell us which ones you want first" className="mb-4 mt-10" />
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
        <p className="ps-caption mt-6">These need each service&apos;s approval before they can connect, so there is no date yet. Your choice is saved in this browser.</p></> : null}
      </div>
    </AppShell>
  );
}
