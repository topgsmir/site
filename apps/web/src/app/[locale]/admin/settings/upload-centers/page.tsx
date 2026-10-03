import { AdminPanelRoute } from "@/components/admin/AdminPanelRoute";

export default function UploadCenterSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  return <AdminPanelRoute params={params} section="settings-upload-centers" />;
}
