import type { Metadata } from "next";
import { AccountScreen } from "@/components/account/AccountScreen";

export const metadata: Metadata = { title: "Account", description: "Manage your Presenta Studio account, API key and preferences." };

export default function AccountPage() {
  return <AccountScreen />;
}
