import type { Metadata } from "next";
import { InviteScreen } from "@/components/teams/InviteScreen";

export const metadata: Metadata = { title: "Team invitation · Presenta Studio" };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <InviteScreen token={token} />;
}
