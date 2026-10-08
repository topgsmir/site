import { AdminPanelRoute } from "@/components/admin/AdminPanelRoute";
export default function TemplateSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  return <AdminPanelRoute params={params} section="settings-template" />;
}
