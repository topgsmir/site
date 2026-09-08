import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { BlogEditor } from "@/components/blog/BlogEditor";
import { isLocale } from "@/lib/i18n";
import { requireUser } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Blog editor", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SellerBlogEditorPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const user = await requireUser(locale, ["seller-admin", "seller-staff"]);
  if (!user.permissions?.includes("blog_manage")) redirect(`/${locale}/seller-dashboard`);
  return <BlogEditor locale={locale} postId={id} backHref={`/${locale}/seller-dashboard?section=blog`} />;
}
