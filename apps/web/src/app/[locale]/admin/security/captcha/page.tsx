import { AdminPanelRoute } from "@/components/admin/AdminPanelRoute";
export default function Page({ params }: { params: Promise<{ locale: string }> }) {
  return <AdminPanelRoute params={params} section="security-captcha" />;
}
