import { AdminPanelRoute, type AdminPanelRouteProps } from "@/components/admin/AdminPanelRoute";

export default function AdminNotificationsPage({ params }: Pick<AdminPanelRouteProps, "params">) {
  return <AdminPanelRoute params={params} section="notifications" />;
}
