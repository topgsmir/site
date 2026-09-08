import {
  AdminPanelRoute,
  type AdminPanelRouteProps
} from "@/components/admin/AdminPanelRoute";

export default function AdminVendorsPage({ params }: Pick<AdminPanelRouteProps, "params">) {
  return <AdminPanelRoute params={params} section="vendors" />;
}
