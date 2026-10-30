import type { Metadata } from "next";
import { ShareLinkScreen } from "@/components/teams/ShareLinkScreen";

export const metadata: Metadata = {
  title: "Shared deck",
  description: "A deck shared with you on Presenta Studio.",
  robots: { index: false, follow: false },
};

export default async function Page({ params, searchParams }: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ embed?: string | string[] }>;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const embed = query.embed === "1" || (Array.isArray(query.embed) && query.embed.includes("1"));
  return <ShareLinkScreen token={token} embed={embed} />;
}
