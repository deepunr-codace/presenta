import type { Metadata } from "next";
import { RemoteScreen } from "@/components/remote/RemoteScreen";

export const metadata: Metadata = {
  title: "Presentation remote · Presenta Studio",
  robots: { index: false, follow: false },
};

export default async function RemotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <RemoteScreen token={token} />;
}
