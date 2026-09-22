import { AdminPanelRoute } from "@/components/admin/AdminPanelRoute";

export default function AdminUploadsPage({ params }: { params: Promise<{ locale: string }> }) {
  return <AdminPanelRoute params={params} section="uploads" />;
}
