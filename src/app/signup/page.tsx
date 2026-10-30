import type { Metadata } from "next";
import { SignupScreen } from "@/components/auth/SignupScreen";

export const metadata: Metadata = { title: "Sign up", description: "Create a free Presenta Studio account: your decks save from the first slide." };

export default function SignupPage() {
  return <SignupScreen />;
}
