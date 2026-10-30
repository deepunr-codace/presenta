import type { Metadata } from "next";
import { PrintView } from "@/components/present/PrintView";
import { resolveDeckRouteId } from "@/lib/deck/resolve-route";

export const metadata: Metadata = {
  title: "Print",
  description: "A print-ready, one-slide-per-page view of your deck.",
  robots: { index: false, follow: false },
};

export default async function PrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id: idOrSlug }, sp] = await Promise.all([params, searchParams]);
  const auto = sp.auto === "1";
  return <PrintView id={await resolveDeckRouteId(idOrSlug)} auto={auto} />;
}
