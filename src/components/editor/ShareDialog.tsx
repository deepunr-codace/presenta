"use client";

import { useEffect, useState, type FormEvent } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Link as LinkIcon, UsersThree, X } from "@phosphor-icons/react";
import {
  ApiError,
  fetchLink,
  fetchShares,
  fetchTeams,
  removeShare,
  setLinkAccess,
  setLinkExpiry,
  setLinkPassword,
  shareLinkUrl,
  shareWithTeam,
  shareWithUser,
  type LinkState,
  type ShareRole,
  type SharesResponse,
  type TeamSummary,
} from "@/lib/collab";
import { useToast } from "@/components/shell/Toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = { id: string; open: boolean; onOpenChange: (open: boolean) => void };

const ROLE_LABEL: Record<ShareRole, string> = { editor: "Can edit", viewer: "Can view" };

function RoleSelect({ value, onChange, label }: { value: ShareRole; onChange: (r: ShareRole) => void; label: string }) {
  return (
    <select className="ps-input !w-auto" value={value} onChange={(e) => onChange(e.target.value as ShareRole)} aria-label={label}>
      <option value="viewer">{ROLE_LABEL.viewer}</option>
      <option value="editor">{ROLE_LABEL.editor}</option>
    </select>
  );
}

/**
 * Share a deck with people, a team, or anyone with the link. Only the owner can change sharing settings.
 */
export function ShareDialog({ id, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const [shares, setShares] = useState<SharesResponse | null>(null);
  const [link, setLink] = useState<LinkState | null>(null);
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notOwner, setNotOwner] = useState(false);
  const [busy, setBusy] = useState(false);

  const [email, setEmail] = useState("");
  const [linkPassword, setLinkPasswordValue] = useState("");
  const [emailRole, setEmailRole] = useState<ShareRole>("editor");
  const [teamId, setTeamId] = useState("");
  const [teamRole, setTeamRole] = useState<ShareRole>("editor");

  useEffect(() => {
    if (!open) return;
    let alive = true;
    Promise.all([fetchShares(id), fetchLink(id), fetchTeams().catch(() => ({ teams: [] as TeamSummary[] }))])
      .then(([s, l, t]) => {
        if (!alive) return;
        setShares(s);
        setLink(l);
        setTeams(t.teams);
        setTeamId((cur) => cur || t.teams[0]?.id || "");
        setNotOwner(false);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        if (err instanceof ApiError && err.status === 403) setNotOwner(true);
        else setError(err instanceof Error ? err.message : "Could not load sharing.");
      });
    return () => {
      alive = false;
    };
  }, [open, id]);

  const run = async (fn: () => Promise<SharesResponse | LinkState | void>, done?: string) => {
    setBusy(true);
    setError(null);
    try {
      const result = await fn();
      if (result && "shares" in result) setShares(result);
      else if (result && "access" in result) setLink(result);
      if (done) toast(done, { tone: "success" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const addPerson = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    await run(() => shareWithUser(id, email.trim(), emailRole), "Shared.");
    setEmail("");
  };

  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(shareLinkUrl(token));
      toast("Link copied.", { tone: "success" });
    } catch {
      toast("Could not copy. Select the link and copy it by hand.", { tone: "error" });
    }
  };

  const embedCode = link?.token && typeof window !== "undefined"
    ? `<iframe src="${shareLinkUrl(link.token)}?embed=1" title="Shared presentation" style="width:100%;aspect-ratio:16/9;border:0" loading="lazy" allow="fullscreen" allowfullscreen></iframe>`
    : "";
  const copyEmbed = async () => {
    if (!embedCode) return;
    try {
      await navigator.clipboard.writeText(embedCode);
      toast("Embed code copied.", { tone: "success" });
    } catch {
      toast("Could not copy. Select the embed code and copy it by hand.", { tone: "error" });
    }
  };

  const anyoneCanView = link?.access === "anyone_view";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share this deck</DialogTitle>
          <DialogDescription>Editors can work on the deck together. Viewers can look, comment and present without changing the slides.</DialogDescription>
        </DialogHeader>

        {notOwner ? <p className="ps-body">Only the owner of this deck can change who it is shared with.</p> : null}
        {error ? (
          <p className="ps-caption" role="alert" style={{ color: "var(--ps-danger)" }}>
            {error}
          </p>
        ) : null}

        {!notOwner && !shares && !error ? <p className="ps-body py-6 text-center">Loading…</p> : null}

        {shares && link ? (
          <div className="flex flex-col gap-5">
            <form className="flex flex-wrap items-center gap-2" onSubmit={addPerson}>
              <input className="ps-input min-w-0 flex-1" type="email" placeholder="Add a person by email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email of the person to share with" />
              <RoleSelect value={emailRole} onChange={setEmailRole} label="Their access" />
              <button type="submit" className="ps-btn ps-btn-primary ps-btn-xs" disabled={busy || !email.trim()}>
                Share
              </button>
            </form>

            {teams.length ? (
              <form
                className="flex flex-wrap items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (teamId) void run(() => shareWithTeam(id, teamId, teamRole), "Shared with the team.");
                }}
              >
                <select className="ps-input min-w-0 flex-1" value={teamId} onChange={(e) => setTeamId(e.target.value)} aria-label="Team to share with">
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      Team: {t.name}
                    </option>
                  ))}
                </select>
                <RoleSelect value={teamRole} onChange={setTeamRole} label="The team's access" />
                <button type="submit" className="ps-btn ps-btn-xs" disabled={busy || !teamId}>
                  Share with team
                </button>
              </form>
            ) : null}

            <section aria-label="People with access">
              <h3 className="ps-label mb-2">People with access</h3>
              {shares.shares.length === 0 ? <p className="ps-caption">Only you, so far.</p> : null}
              <ul className="flex flex-col gap-2">
                {shares.shares.map((s) => (
                  <li key={`${s.kind}:${s.granteeId}`} className="flex items-center gap-2">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--ps-plate)] text-[var(--ps-smoke)]" aria-hidden>
                      {s.kind === "team" ? <UsersThree size={14} /> : (s.name[0] ?? "?").toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px]">{s.name}</span>
                      <span className="ps-caption block truncate">{s.detail}</span>
                    </span>
                    <RoleSelect
                      value={s.role}
                      label={`Access for ${s.name}`}
                      onChange={(r) =>
                        void run(() => (s.kind === "team" ? shareWithTeam(id, s.granteeId, r) : shareWithUser(id, s.detail, r)))
                      }
                    />
                    <button type="button" className="ps-iconbtn" aria-label={`Remove ${s.name}`} title="Remove" onClick={() => void run(() => removeShare(id, s.kind, s.granteeId), "Access removed.")}>
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
              {shares.viaLinkCount ? <p className="ps-caption mt-2">{shares.viaLinkCount} other {shares.viaLinkCount === 1 ? "person has" : "people have"} opened the link.</p> : null}
            </section>

            <section aria-label="Link access">
              <h3 className="ps-label mb-2 flex items-center gap-1.5">
                <LinkIcon size={14} /> Link
              </h3>
              <label className="flex items-start gap-2 text-[13px]">
                <input
                  type="radio"
                  name="link-access"
                  className="mt-1"
                  checked={!anyoneCanView}
                  onChange={() => void run(() => setLinkAccess(id, "restricted"), "The link is off.")}
                />
                <span>
                  Only people I share with
                  <span className="ps-caption block">The link does not work for anyone else.</span>
                </span>
              </label>
              <label className="mt-2 flex items-start gap-2 text-[13px]">
                <input type="radio" name="link-access" className="mt-1" checked={anyoneCanView} onChange={() => void run(() => setLinkAccess(id, "anyone_view"), "Anyone with the link can view.")} />
                <span>
                  Anyone with the link can view
                  <span className="ps-caption block">Anyone can view and present without signing in; they cannot edit.</span>
                </span>
              </label>
              {anyoneCanView && link.token ? (
                <div className="mt-3 grid gap-2">
                  <form className="grid gap-2 rounded-lg border border-[var(--ps-line)] p-3" onSubmit={(event) => {
                    event.preventDefault();
                    if (linkPassword.length < 8 || linkPassword.length > 72) return;
                    void run(() => setLinkPassword(id, linkPassword), "Share password updated.");
                    setLinkPasswordValue("");
                  }}>
                    <div>
                      <h4 className="ps-label">Password protection</h4>
                      <p className="ps-caption">{link.passwordEnabled ? "Viewers need the password to open this link." : "Add a password for people who have the link."}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input className="ps-input min-w-0 flex-1" type="password" autoComplete="new-password" minLength={8} maxLength={72} placeholder={link.passwordEnabled ? "Set a new password" : "At least 8 characters"} value={linkPassword} onChange={(event) => setLinkPasswordValue(event.target.value)} aria-label="Share link password" />
                      <button type="submit" className="ps-btn ps-btn-xs" disabled={busy || linkPassword.length < 8 || linkPassword.length > 72}>{link.passwordEnabled ? "Change" : "Set password"}</button>
                      {link.passwordEnabled ? <button type="button" className="ps-btn ps-btn-xs" disabled={busy} onClick={() => void run(() => setLinkPassword(id, null), "Share password removed.")}>Remove</button> : null}
                    </div>
                  </form>
                  <label className="flex flex-wrap items-center gap-2 text-[13px]">
                    <span className="ps-label">Link expires</span>
                    <select
                      className="ps-input !w-auto"
                      aria-label="Share link expiry"
                      disabled={busy}
                      value={(() => {
                        if (!link.expiresAt) return "never";
                        const hours = Math.round((new Date(link.expiresAt).getTime() - Date.now()) / 3_600_000);
                        return ([24, 168, 720] as const).find((option) => Math.abs(option - hours) < 2)?.toString() ?? "custom";
                      })()}
                      onChange={(event) => {
                        const value = event.target.value;
                        if (value === "never") void run(() => setLinkExpiry(id, null), "Link expiry removed.");
                        else if (value === "24" || value === "168" || value === "720") void run(() => setLinkExpiry(id, Number(value) as 24 | 168 | 720), "Link expiry updated.");
                      }}
                    >
                      <option value="never">Never</option>
                      <option value="24">24 hours</option>
                      <option value="168">7 days</option>
                      <option value="720">30 days</option>
                      {link.expiresAt && ![24, 168, 720].some((hours) => Math.abs(hours - Math.round((new Date(link.expiresAt!).getTime() - Date.now()) / 3_600_000)) < 2) ? <option value="custom" disabled>{new Date(link.expiresAt).getTime() <= Date.now() ? "Expired" : `Expires ${new Date(link.expiresAt).toLocaleDateString()}`}</option> : null}
                    </select>
                  </label>
                  <div className="flex items-center gap-2">
                    <input className="ps-input min-w-0 flex-1" readOnly value={typeof window === "undefined" ? "" : shareLinkUrl(link.token)} onFocus={(e) => e.currentTarget.select()} aria-label="Share link" />
                    <button type="button" className="ps-btn ps-btn-xs" onClick={() => void copy(link.token as string)}>
                      <Copy size={12} /> Copy link
                    </button>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border border-[var(--ps-line)] bg-[var(--ps-surface)] p-3">
                    <QRCodeSVG value={shareLinkUrl(link.token)} size={112} level="M" marginSize={3} title="QR code for the public deck link" className="shrink-0 rounded-md bg-white p-1" />
                    <div>
                      <p className="ps-label">Scan to open this deck</p>
                      <p className="ps-caption mt-1">Anyone with this link can view the deck. Password protection still applies if enabled.</p>
                    </div>
                  </div>
                  <label className="ps-label" htmlFor="deck-embed-code">Embed this deck</label>
                  <textarea id="deck-embed-code" className="ps-input w-full resize-y font-mono text-[11px] leading-4" readOnly rows={3} value={embedCode} onFocus={(e) => e.currentTarget.select()} aria-label="Iframe embed code" />
                  <button type="button" className="ps-btn ps-btn-xs self-start" onClick={() => void copyEmbed()}>
                    <Copy size={12} /> Copy embed code
                  </button>
                </div>
              ) : null}
            </section>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
