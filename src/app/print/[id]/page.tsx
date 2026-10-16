import type { Metadata } from "next";
import { PrintView } from "@/components/present/PrintView";

export const metadata: Metadata = { title: "Print · Presenta Studio" };

export default async function PrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const auto = sp.auto === "1";
  return <PrintView id={id} auto={auto} />;
}
