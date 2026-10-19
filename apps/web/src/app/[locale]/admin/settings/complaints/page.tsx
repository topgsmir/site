import { AdminPanelRoute } from "@/components/admin/AdminPanelRoute";

export default function AdminComplaintsSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  return <AdminPanelRoute params={params} section="settings-complaints" />;
}
