import { AdminPanelRoute } from "@/components/admin/AdminPanelRoute";

export default function BackupSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  return <AdminPanelRoute params={params} section="settings-backup" />;
}
