import { AdminPanelRoute, type AdminPanelRouteProps } from "@/components/admin/AdminPanelRoute";

export default function AdminMarketingPage({ params }: Pick<AdminPanelRouteProps, "params">) {
  return <AdminPanelRoute params={params} section="marketing" />;
}
