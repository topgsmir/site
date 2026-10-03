import { AdminPanelRoute, type AdminPanelRouteProps } from "@/components/admin/AdminPanelRoute";

export default function ProductTemplatesPage({ params }: Pick<AdminPanelRouteProps, "params">) {
  return <AdminPanelRoute params={params} section="product-templates" />;
}
