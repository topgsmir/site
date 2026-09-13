import { AdminPanelRoute } from "@/components/admin/AdminPanelRoute";

export const dynamic = "force-dynamic";
export default async function AdminBridgePage({ params }: { params: Promise<{ locale: string }> }) {
  return <AdminPanelRoute params={params} section="bridge" />;
}
