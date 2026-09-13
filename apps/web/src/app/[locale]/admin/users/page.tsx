import type { Metadata } from "next";
import { AdminPanelRoute } from "@/components/admin/AdminPanelRoute";

export const metadata: Metadata = { title: "Users", robots: { index: false, follow: false } };

export default function AdminUsersPage({ params }: { params: Promise<{ locale: string }> }) {
  return <AdminPanelRoute params={params} section="users" />;
}
