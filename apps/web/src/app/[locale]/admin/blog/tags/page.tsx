import type { Metadata } from "next";
import { AdminPanelRoute } from "@/components/admin/AdminPanelRoute";

export const metadata: Metadata = { title: "Blog tags", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminBlogTagsPage({ params }: { params: Promise<{ locale: string }> }) {
  return <AdminPanelRoute params={params} section="blog-tags" />;
}
