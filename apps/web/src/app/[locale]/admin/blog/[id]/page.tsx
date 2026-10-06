import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { BlogEditor } from "@/components/blog/BlogEditor";
import { isLocale } from "@/lib/i18n";
import { requireUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ new?: string }> }): Promise<Metadata> {
  const query = await searchParams;
  return { title: query.new === "1" ? "افزودن مقاله" : "ویرایش مقاله", robots: { index: false, follow: false } };
}

export default async function AdminBlogEditorPage({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ new?: string }> }) {
  const [{ locale, id }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const user = await requireUser(locale, ["platform-admin", "platform-staff"]);
  if (!user.isPlatformOwner && !user.platformPermissions?.includes("blog_manage")) redirect(`/${locale}`);
  return <BlogEditor postId={id} backHref={`/${locale}/admin/blog`} canRestoreHistory newlyCreated={query.new === "1"} />;
}
