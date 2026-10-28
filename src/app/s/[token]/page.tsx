import type { Metadata } from "next";
import { ShareLinkScreen } from "@/components/teams/ShareLinkScreen";

export const metadata: Metadata = { title: "Shared deck · Presenta Studio" };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ShareLinkScreen token={token} />;
}
