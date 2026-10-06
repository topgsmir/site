import type { Metadata } from "next";
import { AdminPanelRoute } from "@/components/admin/AdminPanelRoute";

export const metadata: Metadata = { title: "Seller statistics", robots: { index: false, follow: false } };

export default function AdminSellerStatisticsPage({ params }: { params: Promise<{ locale: string }> }) {
  return <AdminPanelRoute params={params} section="seller-statistics" />;
}
