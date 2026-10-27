import type { Metadata } from "next";
import { AccountScreen } from "@/components/account/AccountScreen";

export const metadata: Metadata = { title: "Account · Presenta Studio" };

export default function AccountPage() {
  return <AccountScreen />;
}
