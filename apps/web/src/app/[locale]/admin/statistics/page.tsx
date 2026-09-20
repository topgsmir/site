import { AdminPanelRoute, type AdminPanelRouteProps } from "@/components/admin/AdminPanelRoute";

export default function AdminStatisticsPage({ params }: Pick<AdminPanelRouteProps, "params">) {
  return <AdminPanelRoute params={params} section="statistics" />;
}
