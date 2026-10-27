"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

/** Google "G" mark in its brand colours; kept inline so no extra asset request is needed. */
function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.85 2.08-1.81 2.72v2.26h2.92c1.7-1.57 2.69-3.88 2.69-6.62Z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.87-3.04.87-2.34 0-4.32-1.58-5.03-3.71H.92v2.33A8.997 8.997 0 0 0 9 18Z" fill="#34A853" />
      <path d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.92a9.01 9.01 0 0 0 0 8.1l3.05-2.33Z" fill="#FBBC05" />
      <path d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A8.997 8.997 0 0 0 .92 4.95l3.05 2.33C4.68 5.16 6.66 3.58 9 3.58Z" fill="#EA4335" />
    </svg>
  );
}

type Props = {
  /** Where to land after a successful Google sign-in. */
  callbackUrl?: string;
  label?: string;
};

/** "Continue with Google" button; delegates to Auth.js's Google provider. */
export function GoogleButton({ callbackUrl = "/", label = "Continue with Google" }: Props) {
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      className="ps-auth-google"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void signIn("google", { callbackUrl });
      }}
    >
      <GoogleGlyph />
      {busy ? "Redirecting…" : label}
    </button>
  );
}
