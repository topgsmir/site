import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminPanelRoute } from "@/components/admin/AdminPanelRoute";

export const metadata: Metadata = { title: "User history", robots: { index: false, follow: false } };

export default async function AdminUserHistoryPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) notFound();
  return <AdminPanelRoute params={Promise.resolve({ locale })} section="users" userId={id} />;
}
