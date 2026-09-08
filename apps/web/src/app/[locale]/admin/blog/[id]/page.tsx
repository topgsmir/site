import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { BlogEditor } from "@/components/blog/BlogEditor";
import { isLocale } from "@/lib/i18n";
import { requireUser } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Editorial editor", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminBlogEditorPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const user = await requireUser(locale, ["platform-admin", "platform-staff"]);
  if (!user.isPlatformOwner && !user.platformPermissions?.includes("blog_manage")) redirect(`/${locale}`);
  return <BlogEditor locale={locale} postId={id} backHref={`/${locale}/admin/blog`} />;
}
