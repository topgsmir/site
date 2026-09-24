import { AdminPanelRoute } from "@/components/admin/AdminPanelRoute";

export default function AdminBlogSidebarSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  return <AdminPanelRoute params={params} section="settings-blog-sidebar" />;
}
