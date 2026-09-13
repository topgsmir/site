import type { Metadata } from "next";
import { AdminPanelRoute } from "@/components/admin/AdminPanelRoute";

export const metadata: Metadata = { title: "Platform staff", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function StaffPage({ params }: { params: Promise<{ locale: string }> }) {
  return <AdminPanelRoute params={params} section="staff" />;
}
