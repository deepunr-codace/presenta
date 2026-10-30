"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { Gear, SignOut } from "@phosphor-icons/react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

function initialOf(name: string | null | undefined, email: string | null | undefined): string {
  const source = name?.trim() || email?.trim() || "";
  return source ? source[0]!.toUpperCase() : "P";
}

/** Account circle in the shell: Google profile photo when signed in with Google, otherwise the name initial. */
export function Avatar() {
  const { data: session } = useSession();
  const user = session?.user;
  const photo = user?.image || null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<button type="button" className="ps-avatar ps-focus" aria-label="Account" data-photo={photo ? "" : undefined} />}>
        {photo ? <Image src={photo} alt="" fill sizes="32px" referrerPolicy="no-referrer" /> : initialOf(user?.name, user?.email)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="flex min-w-0 items-center gap-2.5 px-2 py-1.5">
          <span className="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--ps-ink-soft)] text-[12px] font-semibold text-[var(--ps-ink)]" aria-hidden>
            {photo ? <Image src={photo} alt="" fill sizes="32px" referrerPolicy="no-referrer" /> : initialOf(user?.name, user?.email)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold text-[var(--ps-ink)]">{user?.name || "Signed in"}</div>
            {user?.email ? <div className="truncate ps-caption">{user.email}</div> : null}
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/account" />}>
          <Gear /> Account settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => void signOut({ callbackUrl: "/login" })}>
          <SignOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
