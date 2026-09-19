import { redirect } from "next/navigation";
import type { Route } from "next";
import type { AdminPanelRouteProps } from "@/components/admin/AdminPanelRoute";

export default async function AdminAuthSettingsPage({ params }: Pick<AdminPanelRouteProps, "params">) {
  const { locale } = await params;
  redirect(`/${locale}/admin/security/login` as Route);
}
