"use client";

import { useState, type FormEvent } from "react";
import { useSession } from "next-auth/react";
import { EnvelopeSimple, GoogleLogo, Password } from "@phosphor-icons/react";
import { useToast } from "@/components/shell/Toast";
import type { AccountProfile } from "./account-data";

function initialOf(name: string | null, email: string): string {
  const source = name?.trim() || email;
  return source ? source[0]!.toUpperCase() : "P";
}

type Props = { account: AccountProfile; onUpdated: (next: AccountProfile) => void };

/** Name, email and sign-in method; the name field is the only editable bit here. */
export function ProfileCard({ account, onUpdated }: Props) {
  const { update } = useSession();
  const { toast } = useToast();
  const [name, setName] = useState(account.name ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = name.trim() !== (account.name ?? "").trim();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!dirty) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Could not save your name.");
        return;
      }
      await update({ name: name.trim() });
      onUpdated({ ...account, name: name.trim() });
      toast("Profile updated.", { tone: "success" });
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ps-glass" data-paper data-hero>
      <div className="flex items-center gap-4">
        <div className="ps-account-avatar" aria-hidden>
          {initialOf(account.name, account.email)}
        </div>
        <div className="min-w-0">
          <h2 className="ps-cardtitle">{account.name || "Your profile"}</h2>
          <p className="ps-cardcaption flex items-center gap-1.5">
            <EnvelopeSimple size={12} /> {account.email}
          </p>
        </div>
        <span className="ps-pill ml-auto shrink-0">
          {account.hasPassword ? (
            <>
              <Password size={12} /> Email
            </>
          ) : (
            <>
              <GoogleLogo size={12} /> Google
            </>
          )}
        </span>
      </div>

      <form className="ps-auth-form mt-5" onSubmit={onSubmit}>
        <div className="ps-auth-field">
          <label htmlFor="account-name" className="ps-label">
            Name
          </label>
          <input id="account-name" type="text" className="ps-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </div>
        {error ? <p className="ps-caption" style={{ color: "var(--ps-danger)" }}>{error}</p> : null}
        <div>
          <button type="submit" className="ps-btn ps-btn-primary ps-btn-xs" disabled={!dirty || busy}>
            {busy ? "Saving…" : "Save name"}
          </button>
        </div>
      </form>
    </section>
  );
}
