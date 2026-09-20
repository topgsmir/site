import { notFound } from "next/navigation";
import { AdminPanelRoute } from "@/components/admin/AdminPanelRoute";

export default async function AdminOrderDetailsPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) notFound();
  return <AdminPanelRoute params={params} section="order-detail" orderId={id} />;
}
