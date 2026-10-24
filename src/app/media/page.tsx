import type { Metadata } from "next";
import { MediaScreen } from "@/components/media/MediaScreen";

export const metadata: Metadata = { title: "Media library · Presenta Studio" };

export default function Page() {
  return <MediaScreen />;
}
