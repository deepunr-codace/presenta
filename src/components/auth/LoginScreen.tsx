"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { AuthShell } from "./AuthShell";
import { GoogleButton } from "./GoogleButton";
import { ErrorNotice } from "@/components/ui-kit/ErrorNotice";

export function LoginScreen() {
  const params = useSearchParams();
  const from = params.get("from");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        setError("That email and password don't match an account.");
        setBusy(false);
        return;
      }
      // Full reload (not router.push) so proxy/server components see the new session cookie.
      window.location.assign(from && from !== "/login" ? from : "/");
    } catch {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <div className="ps-auth-card">
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset, sized by CSS */}
        <img className="ps-auth-card-logo" src="/brand/presenta-wordmark.png" alt="Presenta" />
        <div className="ps-auth-card-head">
          <h1 className="ps-pagetitle">Welcome back</h1>
          <p className="ps-body">Log in to pick up your decks where you left off.</p>
        </div>

        <GoogleButton callbackUrl={from && from !== "/login" ? from : "/"} label="Continue with Google" />

        <div className="ps-auth-divider">
          <span>or log in with email</span>
        </div>

        {error ? <ErrorNotice compact message={error} /> : null}

        <form className="ps-auth-form" onSubmit={onSubmit}>
          <div className="ps-auth-field">
            <label htmlFor="email" className="ps-label">
              Email
            </label>
            <input id="email" type="email" autoComplete="email" required className="ps-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@studio.com" />
          </div>
          <div className="ps-auth-field">
            <div className="ps-auth-field-label-row">
              <label htmlFor="password" className="ps-label">
                Password
              </label>
            </div>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              className="ps-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <button type="submit" className="ps-btn ps-btn-primary ps-btn-md ps-btn-block" disabled={busy}>
            {busy ? "Logging in…" : "Log in"}
          </button>
        </form>

        <p className="ps-body-lg ps-auth-foot">
          New to Presenta?{" "}
          <Link href="/signup">Create an account</Link>
        </p>
      </div>
    </AuthShell>
  );
}
