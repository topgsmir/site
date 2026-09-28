import { AdminPanelRoute } from "@/components/admin/AdminPanelRoute";

export default function SeoSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  return <AdminPanelRoute params={params} section="settings-seo" />;
}
