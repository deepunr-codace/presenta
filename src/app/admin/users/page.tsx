import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UsersAdminScreen } from "@/components/admin/UsersAdminScreen";
import { adminUser } from "@/lib/admin-guard";

export const metadata: Metadata = { title: "Users · Admin", description: "Every account and its usage.", robots: { index: false, follow: false } };

export default async function Page() {
  // Everyone but a listed admin gets the same 404 as a page that does not exist.
  if (!(await adminUser())) notFound();
  return <UsersAdminScreen />;
}
