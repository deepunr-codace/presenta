"use client";

import { useState, type FormEvent } from "react";
import { ShieldCheck } from "@phosphor-icons/react";
import { useToast } from "@/components/shell/Toast";
import { ErrorNotice } from "@/components/ui-kit/ErrorNotice";
import type { AccountProfile } from "./account-data";

const MIN_PASSWORD_LENGTH = 8;

type Props = { account: AccountProfile; onUpdated: (next: AccountProfile) => void };

/** Change password (credentials users) or set one for the first time (Google-only users). */
export function SecurityCard({ account, onUpdated }: Props) {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirm) {
      setError("The passwords don't match.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: account.hasPassword ? currentPassword : undefined, newPassword }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Could not update the password.");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
      onUpdated({ ...account, hasPassword: true });
      toast(account.hasPassword ? "Password updated." : "Password set. You can now log in with email too.", { tone: "success" });
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ps-glass" data-paper>
      <div className="ps-glass-head">
        <span className="ps-iconchip">
          <ShieldCheck size={16} />
        </span>
        <h2 className="ps-cardtitle">Password</h2>
      </div>

      {!account.hasPassword ? (
        <p className="ps-body mb-4">You signed up with Google. Set a password to also log in with your email and this password.</p>
      ) : null}

      {error ? <ErrorNotice compact className="mb-4" message={error} /> : null}

      <form className="ps-auth-form" onSubmit={onSubmit}>
        {account.hasPassword ? (
          <div className="ps-auth-field">
            <label htmlFor="current-password" className="ps-label">
              Current password
            </label>
            <input id="current-password" type="password" autoComplete="current-password" required className="ps-input" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </div>
        ) : null}
        <div className="ps-auth-field">
          <label htmlFor="new-password" className="ps-label">
            New password
          </label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            className="ps-input"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
        </div>
        <div className="ps-auth-field">
          <label htmlFor="confirm-password" className="ps-label">
            Confirm new password
          </label>
          <input id="confirm-password" type="password" autoComplete="new-password" required className="ps-input" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <div>
          <button type="submit" className="ps-btn ps-btn-primary ps-btn-xs" disabled={busy}>
            {busy ? "Saving…" : account.hasPassword ? "Update password" : "Set password"}
          </button>
        </div>
      </form>
    </section>
  );
}
