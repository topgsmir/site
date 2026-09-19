import { AdminPanelRoute } from "@/components/admin/AdminPanelRoute";

export default function AdminCommentsPage({ params }: { params: Promise<{ locale: string }> }) {
  return <AdminPanelRoute params={params} section="settings-comments" />;
}
