import { AdminPanelRoute } from "@/components/admin/AdminPanelRoute";

export default function AdminAiAssistantPage({ params }: { params: Promise<{ locale: string }> }) {
  return <AdminPanelRoute params={params} section="ai-assistant" />;
}
