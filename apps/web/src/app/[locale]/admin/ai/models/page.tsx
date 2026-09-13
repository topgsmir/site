import { AdminPanelRoute } from "@/components/admin/AdminPanelRoute";

export default function AdminAiModelsPage({ params }: { params: Promise<{ locale: string }> }) {
  return <AdminPanelRoute params={params} section="ai-models" />;
}
