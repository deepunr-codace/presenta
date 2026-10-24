import type { Metadata } from "next";
import { BrandKitScreen } from "@/components/brand/BrandKitScreen";

export const metadata: Metadata = { title: "Brand kit · Presenta Studio" };

export default function Page() {
  return <BrandKitScreen />;
}
