import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AiAdminScreen } from "@/components/admin/AiAdminScreen";
import { adminUser } from "@/lib/admin-guard";

export const metadata: Metadata = { title: "Presenta Studio · Admin" };

export default async function Page() {
  // Everyone but a listed admin gets the same 404 as a page that does not exist.
  if (!(await adminUser())) notFound();
  return <AiAdminScreen />;
}
