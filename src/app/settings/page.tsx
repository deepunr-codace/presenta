import type { Metadata } from "next";
import { AccountScreen } from "@/components/account/AccountScreen";

export const metadata: Metadata = { title: "Settings", description: "Manage your Presenta Studio account, API key and preferences." };

/** The same page as /account, at the address people expect. */
export default function Page() {
  return <AccountScreen />;
}
