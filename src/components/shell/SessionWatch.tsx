"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Renders nothing. Sessions are shared by every tab of this browser, so signing out in one tab ends the session
 * for all of them; a tab that was signed in and then sees the session end goes to the sign-in page instead of
 * staying on screen with cached data. Tabs that were never signed in (public share links) are left alone.
 */
export function SessionWatch() {
  const { status } = useSession();
  const router = useRouter();
  const wasSignedIn = useRef(false);

  useEffect(() => {
    if (status === "authenticated") {
      wasSignedIn.current = true;
      return;
    }
    if (status === "unauthenticated" && wasSignedIn.current) {
      wasSignedIn.current = false;
      router.replace("/login");
    }
  }, [status, router]);

  return null;
}
