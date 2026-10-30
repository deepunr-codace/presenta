import type { Metadata } from "next";
import { BrandKitScreen } from "@/components/brand/BrandKitScreen";

export const metadata: Metadata = { title: "Brand kit", description: "Your colours, fonts and logo in one place, applied automatically to every deck you build." };

export default function Page() {
  return <BrandKitScreen />;
}
