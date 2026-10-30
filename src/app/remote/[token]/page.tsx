import type { Metadata } from "next";
import { RemoteScreen } from "@/components/remote/RemoteScreen";

export const metadata: Metadata = {
  title: "Presentation remote",
  description: "Control your presentation from another device.",
  robots: { index: false, follow: false },
};

export default async function RemotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <RemoteScreen token={token} />;
}
