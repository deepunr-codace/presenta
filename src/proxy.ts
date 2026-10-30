import { NextResponse } from "next/server";
import { auth } from "@/auth";

const PUBLIC_ROUTES = new Set(["/login", "/signup"]);

/**
 * Next.js 16 renamed `middleware.ts` to `proxy.ts` (same runtime). Gates every
 * app route behind a session, except the auth pages and API routes.
 */
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = Boolean(req.auth);
  const isPublicRoute = PUBLIC_ROUTES.has(pathname);
  const isPublicShare = /^\/s\/[A-Za-z0-9_-]{20,80}$/.test(pathname);
  const isPublicAsset = pathname.startsWith("/auth/") || pathname.startsWith("/brand/");

  if (!isLoggedIn && !isPublicRoute && !isPublicShare && !isPublicAsset) {
    const url = new URL("/login", req.nextUrl);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  if (isLoggedIn && isPublicRoute) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
