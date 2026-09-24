import { AdminPanelRoute } from "@/components/admin/AdminPanelRoute";

export default function AdminHomepageSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  return <AdminPanelRoute params={params} section="settings-homepage" />;
}
