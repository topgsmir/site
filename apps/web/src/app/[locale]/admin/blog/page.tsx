import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AdminBlogWorkspace } from "@/components/admin/AdminBlogWorkspace";
import { isLocale } from "@/lib/i18n";
import { requireUser } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Editorial workspace", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminBlogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const user = await requireUser(locale, ["platform-admin", "platform-staff"]);
  if (!user.isPlatformOwner && !user.platformPermissions?.includes("blog_manage")) redirect(`/${locale}`);
  return <AdminBlogWorkspace locale={locale} isOwner={Boolean(user.isPlatformOwner)} />;
}
