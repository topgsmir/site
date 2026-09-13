import {
  AdminPanelRoute,
  type AdminPanelRouteProps
} from "@/components/admin/AdminPanelRoute";

export default function AdminPaymentMethodsPage({ params }: Pick<AdminPanelRouteProps, "params">) {
  return <AdminPanelRoute params={params} section="payment-methods" />;
}
