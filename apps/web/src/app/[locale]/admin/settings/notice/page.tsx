import { AdminPanelRoute } from "@/components/admin/AdminPanelRoute";

export default function AdminNoticeSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  return <AdminPanelRoute params={params} section="settings-notice" />;
}
