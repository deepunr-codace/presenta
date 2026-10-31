import type { CSSProperties, ReactNode } from "react";

type Props = {
  children: ReactNode;
};

/**
 * Shared frame for /login and /signup. The product film runs full-bleed behind everything; the logo and title sit
 * in the corners and the form card sits left of centre (centred on phones). Reduced-motion visitors get the film
 * paused on its first frame.
 */
export function AuthShell({ children }: Props) {
  return (
    <div className="ps-auth-shell">
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative backdrop, sized by CSS */}
      <img className="ps-auth-video" src="/auth/login-bg.png" alt="" aria-hidden />
      <div className="ps-auth-veil" aria-hidden />
      <div className="ps-auth-title-block">
        <p className="ps-auth-tagline">
          <span className="ps-auth-line"><span style={{ "--i": 0 } as CSSProperties}>Redefine the art</span></span>
          <span className="ps-auth-line ps-auth-line-accent"><span style={{ "--i": 1 } as CSSProperties}>of influence.</span></span>
        </p>
      </div>
      <main className="ps-auth-main">{children}</main>
    </div>
  );
}
