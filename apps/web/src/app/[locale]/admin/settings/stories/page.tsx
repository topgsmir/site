import { AdminPanelRoute } from "@/components/admin/AdminPanelRoute";

export default function AdminStoriesSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  return <AdminPanelRoute params={params} section="settings-stories" />;
}
