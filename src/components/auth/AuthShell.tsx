import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

/**
 * Shared frame for /login and /signup: the product film runs full-bleed behind a glass card, the logo sits above
 * the form, and a slow light sweep moves over the glass. Reduced-motion visitors get a still frame instead.
 */
export function AuthShell({ children }: Props) {
  return (
    <div className="ps-auth-shell">
      <video className="ps-auth-video" src="/auth/login-bg.mp4" autoPlay muted loop playsInline preload="auto" aria-hidden tabIndex={-1} />
      <div className="ps-auth-veil" aria-hidden />
      <div className="ps-auth-glow ps-auth-glow-a" aria-hidden />
      <div className="ps-auth-glow ps-auth-glow-b" aria-hidden />
      <main className="ps-auth-main">
        <div className="ps-auth-logo">
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset, sized by CSS */}
          <img src="/brand/presenta-logo.png" alt="Presenta" />
        </div>
        {children}
        <p className="ps-auth-legal">Presenta Studio · AI presentation builder</p>
      </main>
    </div>
  );
}
