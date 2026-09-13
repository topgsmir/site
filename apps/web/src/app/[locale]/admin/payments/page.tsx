import type { Route } from "next";
import { redirect } from "next/navigation";
import type { AdminPanelRouteProps } from "@/components/admin/AdminPanelRoute";

export default async function AdminPaymentsPage({ params }: Pick<AdminPanelRouteProps, "params">) {
  const { locale } = await params;
  redirect(`/${locale}/admin/payments/transactions` as Route);
}
