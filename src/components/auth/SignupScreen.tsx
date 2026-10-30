"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { AuthShell } from "./AuthShell";
import { GoogleButton } from "./GoogleButton";
import { ErrorNotice } from "@/components/ui-kit/ErrorNotice";

const MIN_PASSWORD_LENGTH = 8;

export function SignupScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`);
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Could not create the account.");
        return;
      }

      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        setError("Account created, but the automatic login failed. Try logging in.");
        setBusy(false);
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- router.push races the fresh session cookie; proxy needs a real request.
        window.location.assign("/login");
        return;
      }
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- same: full reload so proxy/server components see the new session cookie.
      window.location.assign("/");
    } catch {
      setError("Could not reach the server. Try again.");
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <div className="ps-auth-card">
        <div className="ps-auth-card-head">
          <h1 className="ps-pagetitle">Create your account</h1>
          <p className="ps-body">Free to start — your decks save to your account from the first slide.</p>
        </div>

        <GoogleButton callbackUrl="/" label="Sign up with Google" />

        <div className="ps-auth-divider">
          <span>or sign up with email</span>
        </div>

        {error ? <ErrorNotice compact message={error} /> : null}

        <form className="ps-auth-form" onSubmit={onSubmit}>
          <div className="ps-auth-field">
            <label htmlFor="name" className="ps-label">
              Name
            </label>
            <input id="name" type="text" autoComplete="name" required className="ps-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" />
          </div>
          <div className="ps-auth-field">
            <label htmlFor="email" className="ps-label">
              Email
            </label>
            <input id="email" type="email" autoComplete="email" required className="ps-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@studio.com" />
          </div>
          <div className="ps-auth-field">
            <label htmlFor="password" className="ps-label">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              className="ps-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>
          <button type="submit" className="ps-btn ps-btn-primary ps-btn-md ps-btn-block" disabled={busy}>
            {busy ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="ps-body-lg ps-auth-foot">
          Already have an account? <Link href="/login">Log in</Link>
        </p>
      </div>
    </AuthShell>
  );
}
