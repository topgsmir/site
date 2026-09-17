import {
  AdminPanelRoute,
  type AdminPanelRouteProps
} from "@/components/admin/AdminPanelRoute";

export default function AdminCouponsPage({ params }: Pick<AdminPanelRouteProps, "params">) {
  return <AdminPanelRoute params={params} section="coupons" />;
}
