import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

/**
 * Shared frame for /login and /signup. On wide screens the product film fills a left panel with the logo and a
 * short pitch; the form sits in a calm column on the right. Narrow screens stack them, with the film as a band
 * above the form. Reduced-motion visitors get the film paused on its first frame.
 */
export function AuthShell({ children }: Props) {
  return (
    <div className="ps-auth-shell">
      <aside className="ps-auth-hero">
        <video className="ps-auth-video" src="/auth/login-bg.mp4" autoPlay muted loop playsInline preload="auto" aria-hidden tabIndex={-1} />
        <div className="ps-auth-veil" aria-hidden />
        <div className="ps-auth-hero-body">
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset, sized by CSS */}
          <img className="ps-auth-logo" src="/brand/presenta-logo.png" alt="Presenta" />
          <div className="ps-auth-pitch">
            <p className="ps-auth-headline">
              Your next deck, <span className="ps-auth-accent">already designed</span>.
            </p>
            <p className="ps-auth-sub">Describe a deck in plain language, then edit every slide, theme and brand detail.</p>
          </div>
        </div>
        <p className="ps-auth-legal">Presenta Studio · AI presentation builder</p>
      </aside>
      <main className="ps-auth-main">{children}</main>
    </div>
  );
}
