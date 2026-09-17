import {
  AdminPanelRoute,
  type AdminPanelRouteProps
} from "@/components/admin/AdminPanelRoute";

export default function AdminSmsSettingsPage({ params }: Pick<AdminPanelRouteProps, "params">) {
  return <AdminPanelRoute params={params} section="settings-sms" />;
}
