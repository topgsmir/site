import type { Metadata } from "next";
import {
  AdminPanelRoute,
  type AdminPanelRouteProps
} from "@/components/admin/AdminPanelRoute";

export const metadata: Metadata = {
  title: "Top GSM | Admin",
  robots: {
    index: false,
    follow: false
  }
};

export const dynamic = "force-dynamic";

export default function AdminPanelPage({ params }: Pick<AdminPanelRouteProps, "params">) {
  return <AdminPanelRoute params={params} section="overview" />;
}
