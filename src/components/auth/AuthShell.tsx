import type { ReactNode } from "react";

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
      <img className="ps-auth-video" src="/auth/login-poster.png" alt="" aria-hidden />
      <div className="ps-auth-veil" aria-hidden />
      <aside className="ps-auth-hero">
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset, sized by CSS */}
        <img className="ps-auth-logo" src="/brand/presenta-wordmark.png" alt="Presenta" />
      </aside>
      <main className="ps-auth-main">{children}</main>
    </div>
  );
}
