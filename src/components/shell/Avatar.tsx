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
      <DropdownMenuContent align="end" className="w-52">
        <div className="min-w-0 px-1.5 py-1">
          <div className="truncate ps-label">{user?.name || "Signed in"}</div>
          {user?.email ? <div className="truncate ps-caption">{user.email}</div> : null}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/account" />}>
          <Gear /> Account settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void signOut({ callbackUrl: "/login" })}>
          <SignOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
