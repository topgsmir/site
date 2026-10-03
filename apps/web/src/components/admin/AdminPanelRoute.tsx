import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { isLocale } from "@/lib/i18n";
import { VendorManagement } from "@/components/admin/VendorManagement";

export type AdminSection =
  | "overview"
  | "notifications"
  | "statistics"
  | "vendors"
  | "users"
  | "products"
  | "product-categories"
  | "product-templates"
  | "product-changes"
  | "coupons"
  | "club"
  | "orders"
  | "order-detail"
  | "payment-transactions"
  | "payment-methods"
  | "staff"
  | "bridge"
  | "ai-models"
  | "ai-assistant"
  | "settings-sms"
  | "settings-goghdi"
  | "security-rate-limit"
  | "security-login"
  | "security-captcha"
  | "settings-shipping"
  | "settings-usd"
  | "settings-comments"
  | "settings-notice"
  | "settings-stories"
  | "settings-blog-sidebar"
  | "settings-homepage"
  | "settings-seo"
  | "settings-backup"
  | "settings-upload-centers"
  | "editorial"
  | "blog-categories"
  | "blog-tags"
  | "uploads";

export type AdminPanelRouteProps = {
  params: Promise<{
    locale: string;
  }>;
  section: AdminSection;
  orderId?: string;
  userId?: string;
};

export async function AdminPanelRoute({ params, section, orderId, userId }: AdminPanelRouteProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const user = await requireUser(
    locale,
    section === "editorial" || section === "blog-categories" || section === "blog-tags" || section === "uploads" ? ["platform-admin", "platform-staff"] : ["platform-admin"]
  );

  if (
    (section === "editorial" || section === "blog-categories" || section === "blog-tags" || section === "uploads") &&
    user.role === "platform-staff" &&
    !user.platformPermissions?.includes(section === "uploads" ? "uploads_manage" : "blog_manage")
  ) {
    redirect(`/${locale}`);
  }

  return (
    <VendorManagement
      locale={locale}
      adminName={user.fullName}
      adminUserId={user.id}
      section={section}
      orderId={orderId}
      userId={userId}
      ownerNavigation={user.role === "platform-admin"}
      platformPermissions={user.platformPermissions ?? []}
    />
  );
}
