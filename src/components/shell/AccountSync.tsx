"use client";

import { useSession } from "next-auth/react";
import { useEffect, useRef } from "react";
import { syncAccount } from "@/lib/account-sync";

/** Renders nothing. Once per sign-in it aligns this browser's cached settings with the account. See `syncAccount`. */
export function AccountSync() {
  const { data: session, status } = useSession();
  const userId = status === "authenticated" ? session?.user?.id : undefined;
  const syncedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || syncedFor.current === userId) return;
    syncedFor.current = userId;
    syncAccount(userId)
      .then((movedLegacyData) => {
        // Decks that were uploaded from this browser were not in the lists the page already loaded.
        if (movedLegacyData) window.location.reload();
      })
      .catch((err: unknown) => {
        syncedFor.current = null;
        // eslint-disable-next-line no-console -- there is nowhere in the UI to show a background sync problem
        console.error("Account sync failed", err);
      });
  }, [userId]);

  return null;
}
