import type { Metadata } from "next";
import { MediaScreen } from "@/components/media/MediaScreen";

export const metadata: Metadata = { title: "Media library", description: "Every image and asset you've uploaded or generated, ready to drop into any slide." };

export default function Page() {
  return <MediaScreen />;
}
