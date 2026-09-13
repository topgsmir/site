import {
  AdminPanelRoute,
  type AdminPanelRouteProps
} from "@/components/admin/AdminPanelRoute";

export default function AdminProductChangesPage({ params }: Pick<AdminPanelRouteProps, "params">) {
  return <AdminPanelRoute params={params} section="product-changes" />;
}
