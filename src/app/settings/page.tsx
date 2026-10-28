import type { Metadata } from "next";
import { AccountScreen } from "@/components/account/AccountScreen";

export const metadata: Metadata = { title: "Settings · Presenta Studio" };

/** The same page as /account, at the address people expect. */
export default function Page() {
  return <AccountScreen />;
}
