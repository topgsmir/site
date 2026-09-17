import { AdminPanelRoute } from "@/components/admin/AdminPanelRoute";

export default function AdminUsdSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  return <AdminPanelRoute params={params} section="settings-usd" />;
}
