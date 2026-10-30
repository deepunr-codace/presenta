import type { CSSProperties, ReactNode } from "react";
import { FloorCarousel } from "./FloorCarousel";

type Props = {
  children: ReactNode;
};

/**
 * Shared frame for /login and /signup. The gallery backdrop fills the left panel with a card carousel standing on
 * its floor; the logo and title sit over it. The form is a narrow card in the right column. Narrow screens stack
 * the panel above the form.
 */
export function AuthShell({ children }: Props) {
  return (
    <div className="ps-auth-shell">
      <aside className="ps-auth-hero">
        <div className="ps-auth-stage" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element -- decorative backdrop, sized to the stage */}
          <img className="ps-auth-bg" src="/auth/login-bg.png" alt="" />
          <FloorCarousel />
        </div>
        <div className="ps-auth-veil" aria-hidden />
        <div className="ps-auth-hero-body">
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset, sized by CSS */}
          <img className="ps-auth-logo" src="/brand/presenta-wordmark.png" alt="Presenta" />
          <div className="ps-auth-title-block">
            <span className="ps-auth-title-scrim" aria-hidden />
            <p className="ps-auth-tagline">
              <span className="ps-auth-line"><span style={{ "--i": 0 } as CSSProperties}>Redefine the art</span></span>
              <span className="ps-auth-line ps-auth-line-accent"><span style={{ "--i": 1 } as CSSProperties}>of influence.</span></span>
            </p>
          </div>
          <p className="ps-auth-legal">Presenta Studio · AI presentation builder</p>
        </div>
      </aside>
      <main className="ps-auth-main">{children}</main>
    </div>
  );
}
