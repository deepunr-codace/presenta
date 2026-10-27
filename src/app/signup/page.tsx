import type { Metadata } from "next";
import { SignupScreen } from "@/components/auth/SignupScreen";

export const metadata: Metadata = { title: "Sign up — Presenta Studio" };

export default function SignupPage() {
  return <SignupScreen />;
}
